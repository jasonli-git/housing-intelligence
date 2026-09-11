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


# --- Milestone 21: New Jersey depth -----------------------------------------------


def _hud(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HUD_API_TOKEN", "hud-test")


def test_fmr_is_one_release_per_state_and_fiscal_year(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`statedata` answers every county at once: ten calls, not 210."""
    from hip.sources.hud import FMR_YEARS, HudFmrAdapter

    _hud(monkeypatch)
    refs = HudFmrAdapter(states=["NJ"]).refs()

    assert [r.vintage for r in refs] == [str(y) for y in FMR_YEARS]
    assert refs[0].url.endswith("/fmr/statedata/NJ?year=2026")
    assert len({r.key for r in refs}) == len(refs)
    assert "2016" not in {r.vintage for r in refs}, "the API refuses FY2016"


def test_fmr_records_keep_every_county_and_the_area_it_belongs_to() -> None:
    from hip.sources.hud import HudFmrAdapter

    ref = ReleaseRef("hud_fmr", "fmr", "2026", "https://x", scope="NJ")
    payload = {
        "data": {
            "year": "2026",
            "metroareas": [{"code": "ignored"}],
            "counties": [
                {
                    "fips_code": "3402199999",
                    "county_name": "Mercer County",
                    "metro_name": "Trenton-Princeton, NJ MSA",
                    "smallarea_status": "0",
                    "FMR Percentile": 40,
                    "Two-Bedroom": 1950,
                }
            ],
        }
    }

    [row] = HudFmrAdapter.to_records(payload, ref)
    assert row["fips_code"] == "3402199999"
    assert row["two_bedroom"] == 1950
    assert row["fmr_area"] == "Trenton-Princeton, NJ MSA"
    assert row["fiscal_year"] == "2026"
    with pytest.raises(ValueError, match="data.counties"):
        HudFmrAdapter.to_records({"data": {}}, ref)


def test_chas_refs_are_each_county_and_each_state_directory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HUD's entity ids drop leading zeros: Mercer is 21, not 021, which answers []."""
    from hip.sources.hud import CHAS_VINTAGE, HudChasAdapter

    _hud(monkeypatch)
    refs = HudChasAdapter(states=["NJ"], county_fips=["34001", "34021"]).refs()

    counties = [r for r in refs if r.layer.startswith("county_")]
    assert [r.layer for r in counties] == ["county_34001", "county_34021"]
    assert counties[1].url.endswith(
        f"/chas?type=3&year={CHAS_VINTAGE}&stateId=34&entityId=21"
    )
    [directory] = [r for r in refs if r.layer == "mcds"]
    assert directory.url.endswith("/chas/listMCDs/34")
    assert directory.vintage == "current"


class _ChasFake:
    """HUD's directory and one CHAS row per entity, with a download counter."""

    def __init__(self) -> None:
        self.downloads = 0

    def __call__(self, ref: ReleaseRef, destination: Path) -> None:
        import json

        self.downloads += 1
        if "listMCDs" in ref.url:
            body: object = [
                {"statecode": "34", "entityId": "70", "mcdname": "Aberdeen township"},
                {"statecode": "36", "entityId": "70", "mcdname": "another state"},
                {
                    "statecode": "34",
                    "entityId": "0",
                    "mcdname": "County subdivisions not defined",
                },
            ]
        else:
            body = [{"geoname": "x", "year": "2018-2022", "A17": "100.0", "D8": "25.0"}]
        destination.write_text(json.dumps(body))


def test_municipal_chas_refs_come_from_the_cached_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The MCD list is HUD's, so it is fetched as a release — and a re-run, including
    `hip load` rebuilding provenance, derives the same refs from the cache offline."""
    from hip.sources.hud import HudChasAdapter

    _hud(monkeypatch)
    adapter = HudChasAdapter(states=["NJ"], county_fips=["34021"])
    fake = _ChasFake()
    monkeypatch.setattr(adapter, "_fetch_bytes", fake)

    first = [r.ref.layer for r in adapter.fetch_all(raw_dir=tmp_path)]
    assert first == ["county_34021", "mcds", "mcd_3400070"], (
        "other states, and code 0 — water, not a municipality — are dropped"
    )
    assert fake.downloads == 3

    again = list(adapter.fetch_all(raw_dir=tmp_path))
    assert [r.ref.layer for r in again] == first
    assert all(r.from_cache for r in again)
    assert fake.downloads == 3


def test_chas_records_carry_the_key_their_request_was_made_with() -> None:
    """A CHAS row names its geography only in prose; the key comes from the ref."""
    from hip.sources.hud import HudChasAdapter

    county = ReleaseRef("hud_chas", "county_34021", "2018-2022", "https://x")
    [row] = HudChasAdapter.to_records([{"year": "2018-2022", "A17": "51915.0"}], county)
    assert (row["level"], row["geo_key"], row["chas_year"]) == (
        "county",
        "34021",
        "2018-2022",
    )
    assert row["A17"] == "51915.0"

    municipal = ReleaseRef("hud_chas", "mcd_3400070", "2018-2022", "https://x")
    assert HudChasAdapter.to_records([], municipal) == [
        {"level": "mcd", "geo_key": "3400070", "chas_year": None}
    ], "an empty answer lands as one keyed row rather than failing the landing"


def test_acs_housing_tables_are_their_own_layers(monkeypatch: pytest.MonkeyPatch) -> None:
    """The raw cache keys on (layer, scope, vintage), not the URL: widening the existing
    request would have been answered from cached files that lack the new columns."""
    from hip.sources.census_acs import HOUSING_VARIABLES, AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    refs = AcsAdapter(states=["NJ"]).refs(vintage="2023")

    by_layer = {r.layer: r for r in refs}
    assert set(by_layer) == {"county", "cousub", "housing_county", "housing_cousub"}
    assert "B25002" not in by_layer["county"].url, "the cached request is unchanged"
    assert all(v in by_layer["housing_cousub"].url for v in HOUSING_VARIABLES)


def test_permits_add_the_region_place_file_for_every_year() -> None:
    from hip.sources.census_permits import YEARS, PermitsAdapter

    refs = PermitsAdapter(states=["NJ"]).refs()

    places = [r for r in refs if r.layer == "place"]
    assert len(places) == YEARS == len(refs) - len(places)
    assert places[0].url.endswith("/Place/Northeast%20Region/ne2412y.txt")
    assert places[0].scope == "ne"


def test_permits_refuse_a_state_with_no_mapped_place_region() -> None:
    """A guessed folder would fail as a 404 inside a run; refusing names the fix."""
    from hip.sources.census_permits import PermitsAdapter

    with pytest.raises(ConfigError, match="PLACE_REGIONS"):
        PermitsAdapter(states=["CA"]).refs()


def test_the_new_hud_sources_are_registered_as_metric_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hip.config import load_geography
    from hip.sources.hud import HudChasAdapter, HudFmrAdapter
    from hip.sources.registry import IMPLEMENTED, METRIC_SOURCES, build_adapter

    _hud(monkeypatch)
    scope = load_geography()
    assert isinstance(build_adapter("hud_fmr", scope), HudFmrAdapter)
    assert isinstance(build_adapter("hud_chas", scope), HudChasAdapter)
    assert {"hud_fmr", "hud_chas"} <= set(IMPLEMENTED) & set(METRIC_SOURCES)


def test_an_adapter_with_a_request_interval_waits_between_downloads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """HUD User allows 60 requests a minute; the first CHAS run hit 429 at release 101."""
    import time

    clock = {"now": 100.0}
    slept: list[float] = []
    monkeypatch.setattr(time, "monotonic", lambda: clock["now"])
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))

    class Paced(FakeAdapter):
        request_interval_s = 1.1

        def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
            return [
                ReleaseRef(self.source_id, f"layer{i}", "2025", "https://x/f")
                for i in range(2)
            ]

    list(Paced().fetch_all(raw_dir=tmp_path))
    assert slept == [pytest.approx(1.1)]

    slept.clear()
    list(Paced().fetch_all(raw_dir=tmp_path))
    assert slept == [], "a cached release makes no request, so it waits for none"


def test_a_rate_limited_download_waits_before_retrying(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An instant retry after 429 only spends the attempts inside the same window."""
    import time

    import httpx

    slept: list[float] = []
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))

    class Limited(FakeAdapter):
        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            self.downloads += 1
            if self.downloads == 1:
                request = httpx.Request("GET", ref.url)
                raise httpx.HTTPStatusError(
                    "429",
                    request=request,
                    response=httpx.Response(429, request=request),
                )
            destination.write_bytes(self.payload)

    adapter = Limited()
    adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert adapter.downloads == 2
    assert slept == [60.0], "no Retry-After, so the whole minute"
