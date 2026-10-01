"""A source downloaded by hand (Milestone 31, ARCHITECTURE #272).

Zillow's Terms of Use forbid automated fetching, so its files are dropped into
`data/manual/<source_id>/` and `fetch` reads them from there. These pin that it never
makes a request, ingests a new file exactly as a download would, keeps the last file when
nothing new was handed in, and says what to do when there is nothing at all.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from hip.sources.base import SourceError
from hip.sources.zillow import ZhviAdapter


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*_: object, **__: object) -> None:
        raise AssertionError("a manual source made a network request")

    monkeypatch.setattr(httpx, "stream", refuse)
    monkeypatch.setattr(httpx, "get", refuse)
    monkeypatch.setattr(httpx, "head", refuse)


def _setup(tmp_path: Path) -> tuple[ZhviAdapter, Path, Path]:
    adapter = ZhviAdapter()
    ref = adapter.refs()[0]
    raw = tmp_path / "raw"
    dropped = adapter.manual_path(ref, raw)
    return adapter, raw, dropped


def test_zillow_is_downloaded_by_hand() -> None:
    assert ZhviAdapter.manual
    assert ZhviAdapter.manual_from == "https://www.zillow.com/research/data/"


def test_a_dropped_file_is_ingested_like_a_download(tmp_path: Path) -> None:
    adapter, raw, dropped = _setup(tmp_path)
    ref = adapter.refs()[0]
    dropped.parent.mkdir(parents=True)
    dropped.write_text("RegionID,2026-08-31\n1,100\n")

    release = adapter.fetch(ref, raw_dir=raw)

    assert release.path.read_text() == dropped.read_text()
    assert release.path.is_relative_to(raw / "zillow_zhvi")
    assert (release.dir / "manifest.json").exists()
    assert release.path.name == dropped.name


def test_the_same_file_again_is_the_cached_release(tmp_path: Path) -> None:
    adapter, raw, dropped = _setup(tmp_path)
    ref = adapter.refs()[0]
    dropped.parent.mkdir(parents=True)
    dropped.write_text("RegionID,2026-08-31\n1,100\n")
    first = adapter.fetch(ref, raw_dir=raw)

    again = adapter.fetch(ref, raw_dir=raw)
    assert again.from_cache and again.sha256 == first.sha256

    dropped.write_text("RegionID,2026-09-30\n1,101\n")
    newer = adapter.fetch(ref, raw_dir=raw)
    assert not newer.from_cache and newer.sha256 != first.sha256


def test_with_nothing_handed_in_the_last_file_stands(tmp_path: Path) -> None:
    adapter, raw, dropped = _setup(tmp_path)
    ref = adapter.refs()[0]
    dropped.parent.mkdir(parents=True)
    dropped.write_text("RegionID,2026-08-31\n1,100\n")
    first = adapter.fetch(ref, raw_dir=raw)
    dropped.unlink()

    assert adapter.fetch(ref, raw_dir=raw).sha256 == first.sha256


def test_with_nothing_at_all_it_says_what_to_download(tmp_path: Path) -> None:
    adapter, raw, dropped = _setup(tmp_path)
    with pytest.raises(SourceError, match="downloaded by hand") as failed:
        adapter.fetch(adapter.refs()[0], raw_dir=raw)
    assert dropped.name in str(failed.value)
    assert "zillow.com/research/data" in str(failed.value)
