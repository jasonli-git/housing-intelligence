"""Source adapters: ref construction and the shared download/cache machinery.

Nothing here touches the network. The adapter's HTTP call is the one thing stubbed;
caching, content addressing, and manifest writing are exercised for real.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hip.config import ConfigError
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError, redact
from hip.sources.tiger import TigerAdapter, shapefile_member

PAYLOAD = b"tiger-bytes"


class FakeAdapter(SourceAdapter):
    """Writes fixed bytes instead of downloading, and counts how often it is asked."""

    source_id = "fake_source"
    default_vintage = "2025"

    def __init__(self, payload: bytes = PAYLOAD) -> None:
        self.payload = payload
        self.downloads = 0

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="demo",
                vintage=vintage or self.default_vintage,
                url="https://example.invalid/demo.zip",
            )
        ]

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        self.downloads += 1
        destination.write_bytes(self.payload)


def test_tiger_builds_one_ref_per_layer_and_state() -> None:
    refs = TigerAdapter(states=["NJ"]).refs()

    assert {r.layer for r in refs} == {"state", "county", "cousub", "tract", "zcta"}
    # National layers carry no scope; per-state layers do.
    assert {r.scope for r in refs} == {None, "NJ"}
    assert all("TIGER2025" in r.url for r in refs)


def test_tiger_uses_state_fips_not_the_state_code() -> None:
    cousub = next(r for r in TigerAdapter(states=["NJ"]).refs() if r.layer == "cousub")

    assert cousub.url.endswith("tl_2025_34_cousub.zip")
    assert shapefile_member(cousub) == "tl_2025_34_cousub.shp"


def test_tiger_scales_to_more_states_without_code_change() -> None:
    refs = TigerAdapter(states=["NJ", "NY"]).refs()

    per_state = [r for r in refs if r.scope is not None]
    assert len(per_state) == 4  # cousub + tract, times two states
    assert {r.scope for r in per_state} == {"NJ", "NY"}
    assert sum("tl_2025_36_" in r.url for r in refs) == 2  # NY is FIPS 36


def test_unknown_state_names_the_offending_value() -> None:
    with pytest.raises(ConfigError) as exc:
        TigerAdapter(states=["ZZ"]).refs()

    assert "ZZ" in str(exc.value)


def test_ref_cache_keys_are_unique_per_state() -> None:
    refs = TigerAdapter(states=["NJ", "NY"]).refs()

    assert len({r.key for r in refs}) == len(refs)


def test_fetch_is_content_addressed_and_writes_a_manifest(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    release = adapter.fetch(ref, raw_dir=tmp_path)

    assert release.path.read_bytes() == PAYLOAD
    assert release.sha256[:16] in str(release.path)
    manifest = release.dir / "manifest.json"
    assert manifest.exists()
    assert release.sha256 in manifest.read_text()


def test_second_fetch_uses_the_cache_without_downloading(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    first = adapter.fetch(ref, raw_dir=tmp_path)
    second = adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 1
    assert second.from_cache is True
    assert second.sha256 == first.sha256


def test_force_redownloads_but_reuses_the_same_directory(tmp_path: Path) -> None:
    """Identical upstream bytes must not create a second release (ARCHITECTURE #10)."""
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    first = adapter.fetch(ref, raw_dir=tmp_path)
    second = adapter.fetch(ref, raw_dir=tmp_path, force=True)

    assert adapter.downloads == 2
    assert second.path == first.path


def test_changed_upstream_bytes_produce_a_new_release(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    first = adapter.fetch(ref, raw_dir=tmp_path)

    adapter.payload = b"revised-tiger-bytes"
    second = adapter.fetch(ref, raw_dir=tmp_path, force=True)

    assert second.sha256 != first.sha256
    assert second.dir != first.dir
    assert first.path.exists(), "previous release must remain; raw data is immutable"


def test_missing_cached_file_falls_back_to_downloading(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    release = adapter.fetch(ref, raw_dir=tmp_path)
    release.path.unlink()

    recovered = adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 2
    assert recovered.path.exists()


class BrokenAdapter(FakeAdapter):
    """Fails a configurable number of times before succeeding."""

    def __init__(self, failures: int) -> None:
        super().__init__()
        self.remaining_failures = failures

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        self.downloads += 1
        if self.remaining_failures > 0:
            self.remaining_failures -= 1
            raise OSError("connection reset")
        destination.write_bytes(self.payload)


def test_download_failure_names_the_source_and_layer(tmp_path: Path) -> None:
    adapter = BrokenAdapter(failures=99)

    with pytest.raises(SourceError) as exc:
        adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert "fake_source" in str(exc.value)
    assert "demo" in str(exc.value)


def test_a_transient_failure_is_retried(tmp_path: Path) -> None:
    """Retry lives in the base class, so every adapter gets it without opting in."""
    adapter = BrokenAdapter(failures=2)

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert adapter.downloads == 3
    assert release.path.read_bytes() == PAYLOAD


# --- credentials never reach disk (#76) --------------------------------------------


class KeyedAdapter(FakeAdapter):
    """A source that authenticates by query parameter, as Census and FRED both do."""

    source_id = "keyed_source"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="demo",
                vintage=vintage or self.default_vintage,
                url="https://api.example.invalid/data/acs5?get=NAME&key=SUPERSECRET",
            )
        ]


@pytest.mark.parametrize(
    "url",
    [
        "https://x.invalid/a?key=SUPERSECRET",
        "https://x.invalid/a?api_key=SUPERSECRET",
        "https://x.invalid/a?apikey=SUPERSECRET",
        "https://x.invalid/a?registrationkey=SUPERSECRET&startyear=2006",
        "https://x.invalid/a?token=SUPERSECRET",
        "Server error for url 'https://x.invalid/a?key=SUPERSECRET'",
    ],
)
def test_every_credential_parameter_is_redacted(url: str) -> None:
    assert "SUPERSECRET" not in redact(url)


def test_redaction_keeps_the_rest_of_the_url_readable() -> None:
    """Which endpoint a release came from is provenance; the key is not."""
    out = redact("https://api.example.invalid/data/2023/acs5?get=NAME&key=SECRET")

    assert out == "https://api.example.invalid/data/2023/acs5?get=NAME&key=***"


def test_a_key_never_becomes_part_of_a_filename(tmp_path: Path) -> None:
    """The failure this prevents: files literally named `...?key=<live key>`."""
    adapter = KeyedAdapter()

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert release.path.name == "acs5"
    assert not any("SUPERSECRET" in path.name for path in tmp_path.rglob("*"))


def test_the_manifest_records_a_redacted_url(tmp_path: Path) -> None:
    adapter = KeyedAdapter()
    adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    manifests = list(tmp_path.rglob("manifest.json"))
    assert manifests, "no manifest written"
    for manifest in manifests:
        text = manifest.read_text()
        assert "SUPERSECRET" not in text
        assert "key=***" in text


def test_a_download_failure_does_not_echo_the_key(tmp_path: Path) -> None:
    """httpx renders the failing URL into its message; a keyed source's URL has a key."""

    class FailingKeyed(KeyedAdapter):
        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            raise OSError(f"connection reset for {ref.url}")

    adapter = FailingKeyed()

    with pytest.raises(SourceError) as exc:
        adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert "SUPERSECRET" not in str(exc.value)
    # The diagnosis survives the redaction.
    assert "OSError" in str(exc.value)
    assert "keyed_source" in str(exc.value)


def test_a_plain_file_url_still_names_the_file(tmp_path: Path) -> None:
    """Dropping the query string must not change the name of an ordinary download."""
    adapter = FakeAdapter()

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert release.path.name == "demo.zip"
