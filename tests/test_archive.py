"""The raw archive in object storage (Milestone 56, `hip.archive`).

The bucket is a local folder: rclone treats a plain path as a remote, so push, listing,
restore and the index pull run through the real rclone, end to end, with no network.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import asdict, replace
from datetime import UTC, datetime
from pathlib import Path

import pytest

from hip import archive
from hip.archive import Archive, archive_files, trimmable
from hip.cli import _reads_file
from hip.landing.tabular import parquet_path, record_landed
from hip.sources import base
from hip.sources.base import Release, SourceError

from .test_sources import FakeAdapter

pytestmark = pytest.mark.skipif(shutil.which("rclone") is None, reason="needs rclone")


def _release(raw: Path, source: str, sha: str, name: str, body: bytes) -> Path:
    folder = raw / source / sha[:16]
    folder.mkdir(parents=True)
    (folder / name).write_bytes(body)
    manifest = {
        "filename": name,
        "sha256": sha,
        "fetched_at": datetime.now(UTC).isoformat(),
        "source_id": source,
        "layer": "county",
        "vintage": "current",
        "scope": None,
    }
    (folder / "manifest.json").write_text(json.dumps(manifest))
    return folder / name


def _land(parquet: Path, source: str, sha: str | None) -> None:
    """Parquet for `source`'s county layer, stamped as built from `sha`."""
    out = parquet / source / "current" / "county.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(b"PAR1")
    if sha:
        out.with_suffix(".parquet.src").write_text(sha + "\n")


@pytest.fixture
def raw(tmp_path: Path) -> Path:
    raw = tmp_path / "raw"
    _release(raw, "zillow", "a" * 64, "zhvi.csv", b"old")
    _release(raw, "zillow", "b" * 64, "zhvi.csv", b"current")
    (raw / "zillow" / "index.json").write_text(json.dumps({"county@current": "b" * 64}))
    (raw / "refresh-state.json").write_text("{}")
    return raw


def test_only_the_file_a_manifest_names_is_archived(tmp_path: Path) -> None:
    """A release fetched before 2026-08-12 also holds its file under the request URL,
    which for the Census API carried the key; that copy never goes up."""
    raw = tmp_path / "raw"
    path = _release(raw, "census_acs", "d" * 64, "acs5", b"rows")
    (path.parent / "acs5?get=NAME&key=SECRET").write_bytes(b"rows")
    (raw / "photos").mkdir()
    (raw / "photos" / "x.jpg").write_bytes(b"jpg")

    keys = archive_files(raw)

    assert f"census_acs/{'d' * 16}/acs5" in keys
    assert "photos/x.jpg" in keys
    assert not any("key=" in k for k in keys)


def test_trim_takes_superseded_files_and_current_ones_already_landed(
    raw: Path, tmp_path: Path
) -> None:
    parquet = tmp_path / "parquet"
    held = {k: (raw / k).stat().st_size for k in archive_files(raw)}

    def trimmed() -> list[str]:
        found = trimmable(raw, held, parquet_dir=parquet)
        return [t.path.parent.name for t in found]

    # Nothing landed: the current file is still to be read, so only the superseded goes.
    assert trimmed() == ["a" * 16]
    # Parquet built from an earlier release does not count.
    _land(parquet, "zillow", "a" * 64)
    assert trimmed() == ["a" * 16]
    _land(parquet, "zillow", "b" * 64)
    assert trimmed() == ["a" * 16, "b" * 16]


def test_trim_keeps_anything_the_bucket_lacks_or_holds_at_another_size(
    raw: Path, tmp_path: Path
) -> None:
    held = {k: (raw / k).stat().st_size for k in archive_files(raw)}
    del held[f"zillow/{'a' * 16}/zhvi.csv"]
    assert trimmable(raw, held, parquet_dir=tmp_path) == []
    held[f"zillow/{'a' * 16}/zhvi.csv"] = 999
    assert trimmable(raw, held, parquet_dir=tmp_path) == []


def test_trim_finds_parquet_where_landing_writes_it(tmp_path: Path) -> None:
    """`archive` rebuilds `parquet_path` from the manifest; the two must agree."""
    ref = FakeAdapter().refs()[0]
    for scope in (None, "NJ"):
        release = Release(
            ref=replace(ref, scope=scope),
            path=tmp_path / "x",
            sha256="e" * 64,
            size_bytes=1,
            fetched_at=datetime.now(UTC),
        )
        out = parquet_path(release, tmp_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"PAR1")
        record_landed(release, out)
        data = {**asdict(release.ref), "sha256": release.sha256}
        assert archive._landed(data, tmp_path)


def test_push_trim_and_restore_round_trip(raw: Path, tmp_path: Path) -> None:
    bucket = Archive(str(tmp_path / "bucket"))
    bucket.push(raw)
    assert set(bucket.listing()) == set(archive_files(raw))

    old = raw / "zillow" / ("a" * 16) / "zhvi.csv"
    sha = archive._sha256(old)
    for item in trimmable(raw, bucket.listing(), parquet_dir=tmp_path):
        item.path.unlink()
    assert not old.exists()
    assert (raw / "zillow" / ("a" * 16) / "manifest.json").exists()

    # A wrong hash leaves the file absent rather than standing in for the real one.
    assert bucket.restore(old, raw, "f" * 64) is False
    assert not old.exists()
    assert bucket.restore(old, raw, sha) is True
    assert old.read_bytes() == b"old"


def test_a_new_mac_pulls_manifests_and_indexes_but_no_release_file(
    raw: Path, tmp_path: Path
) -> None:
    bucket = Archive(str(tmp_path / "bucket"))
    bucket.push(raw)
    fresh = tmp_path / "fresh"

    bucket.pull_index(fresh)

    pulled = {p.relative_to(fresh).as_posix() for p in fresh.rglob("*") if p.is_file()}
    assert "zillow/index.json" in pulled
    assert "refresh-state.json" in pulled
    assert f"zillow/{'b' * 16}/manifest.json" in pulled
    assert not any(p.endswith(".csv") for p in pulled)


def test_a_trimmed_release_is_answered_from_cache_and_restored_only_on_a_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = tmp_path / "raw"
    bucket = Archive(str(tmp_path / "bucket"))
    monkeypatch.setattr(base, "configured", lambda: bucket)
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    release = adapter.fetch(ref, raw_dir=raw)
    body = release.path.read_bytes()
    bucket.push(raw)
    release.path.unlink()

    again = adapter.fetch(ref, raw_dir=raw, cached_only=True)
    assert again.from_cache is True
    assert not again.path.exists(), "nothing read it, so nothing was fetched back"

    assert base.local(again).path.read_bytes() == body
    assert adapter.downloads == 1


def test_a_read_that_cannot_be_restored_says_so(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = tmp_path / "raw"
    bucket = Archive(str(tmp_path / "empty-bucket"))
    monkeypatch.setattr(base, "configured", lambda: bucket)
    adapter = FakeAdapter()
    release = adapter.fetch(adapter.refs()[0], raw_dir=raw)
    release.path.unlink()

    with pytest.raises(SourceError, match="could not be restored"):
        base.local(release)


def test_land_reads_a_trimmed_file_only_when_its_parquet_is_missing_or_stale(
    tmp_path: Path,
) -> None:
    adapter = FakeAdapter()
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    release.path.unlink()
    parquet = tmp_path / "parquet"
    assert _reads_file(adapter, release, parquet, overwrite=False)

    out = parquet_path(release, parquet)
    out.parent.mkdir(parents=True)
    out.write_bytes(b"PAR1")
    record_landed(release, out)
    assert not _reads_file(adapter, release, parquet, overwrite=False)
    assert _reads_file(adapter, release, parquet, overwrite=True)


def test_without_an_archive_a_missing_file_is_downloaded_as_before(
    tmp_path: Path,
) -> None:
    assert archive.configured() is None
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    adapter.fetch(ref, raw_dir=tmp_path).path.unlink()

    adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 2
