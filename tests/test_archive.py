"""The raw archive in object storage (Milestone 56, `hip.archive`).

The bucket is a local folder: rclone treats a plain path as a remote, so push, listing,
restore and the index pull run through the real rclone, end to end, with no network.
"""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from hip import archive
from hip.archive import Archive, archive_files, trimmable
from hip.sources import base

from .test_sources import FakeAdapter

pytestmark = pytest.mark.skipif(shutil.which("rclone") is None, reason="needs rclone")


def _release(
    raw: Path, source: str, sha: str, name: str, body: bytes, *, days: int
) -> Path:
    folder = raw / source / sha[:16]
    folder.mkdir(parents=True)
    (folder / name).write_bytes(body)
    fetched = datetime.now(UTC) - timedelta(days=days)
    (folder / "manifest.json").write_text(
        json.dumps({"filename": name, "sha256": sha, "fetched_at": fetched.isoformat()})
    )
    return folder / name


@pytest.fixture
def raw(tmp_path: Path) -> Path:
    raw = tmp_path / "raw"
    _release(raw, "zillow", "a" * 64, "zhvi.csv", b"old", days=90)
    _release(raw, "zillow", "b" * 64, "zhvi.csv", b"current", days=90)
    _release(raw, "zillow", "c" * 64, "zhvi.csv", b"recent", days=2)
    (raw / "zillow" / "index.json").write_text(json.dumps({"zhvi@current": "b" * 64}))
    (raw / "refresh-state.json").write_text("{}")
    return raw


def test_only_the_file_a_manifest_names_is_archived(tmp_path: Path) -> None:
    """A release fetched before 2026-08-12 also holds its file under the request URL,
    which for the Census API carried the key; that copy never goes up."""
    raw = tmp_path / "raw"
    path = _release(raw, "census_acs", "d" * 64, "acs5", b"rows", days=1)
    (path.parent / "acs5?get=NAME&key=SECRET").write_bytes(b"rows")
    (raw / "photos").mkdir()
    (raw / "photos" / "x.jpg").write_bytes(b"jpg")

    keys = archive_files(raw)

    assert f"census_acs/{'d' * 16}/acs5" in keys
    assert "photos/x.jpg" in keys
    assert not any("key=" in k for k in keys)


def test_trim_keeps_the_current_the_recent_and_anything_the_bucket_lacks(
    raw: Path,
) -> None:
    held = {k: (raw / k).stat().st_size for k in archive_files(raw)}

    found = trimmable(raw, held, keep_days=30)

    assert [t.path.parent.name for t in found] == ["a" * 16]
    # Not in the bucket, or there at another size: kept.
    del held[f"zillow/{'a' * 16}/zhvi.csv"]
    assert trimmable(raw, held, keep_days=30) == []
    held[f"zillow/{'a' * 16}/zhvi.csv"] = 999
    assert trimmable(raw, held, keep_days=30) == []


def test_push_trim_and_restore_round_trip(raw: Path, tmp_path: Path) -> None:
    bucket = Archive(str(tmp_path / "bucket"))
    bucket.push(raw)
    assert set(bucket.listing()) == set(archive_files(raw))

    old = raw / "zillow" / ("a" * 16) / "zhvi.csv"
    sha = archive._sha256(old)
    for item in trimmable(raw, bucket.listing(), keep_days=30):
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


def test_a_fetch_restores_a_trimmed_release_instead_of_downloading(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = tmp_path / "raw"
    bucket = Archive(str(tmp_path / "bucket"))
    monkeypatch.setattr(base, "configured", lambda: bucket)
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    release = adapter.fetch(ref, raw_dir=raw)
    bucket.push(raw)
    release.path.unlink()

    again = adapter.fetch(ref, raw_dir=raw)

    assert adapter.downloads == 1
    assert again.from_cache is True
    assert again.path.read_bytes() == release.path.read_bytes()


def test_without_an_archive_a_missing_file_is_downloaded_as_before(
    tmp_path: Path,
) -> None:
    assert archive.configured() is None
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    adapter.fetch(ref, raw_dir=tmp_path).path.unlink()

    adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 2
