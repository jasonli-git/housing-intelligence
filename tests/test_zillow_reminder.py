"""The monthly reminder to download Zillow by hand (#297): reckoned from the calendar
and the files on disk, never by asking Zillow's site."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from hip.sources.zillow import due, held_through, published_through, third_thursday

RELEASES_2026 = [
    date(2026, 1, 15), date(2026, 2, 19), date(2026, 3, 19), date(2026, 4, 16),
    date(2026, 5, 21), date(2026, 6, 18), date(2026, 7, 16), date(2026, 8, 20),
    date(2026, 9, 17), date(2026, 10, 15), date(2026, 11, 19), date(2026, 12, 17),
]  # fmt: skip


@pytest.mark.parametrize("release", RELEASES_2026)
def test_every_2026_release_is_its_months_third_thursday(release: date) -> None:
    assert third_thursday(release.year, release.month) == release


def test_last_month_counts_as_published_from_the_day_after_release() -> None:
    assert published_through(date(2026, 10, 15)) == date(2026, 8, 31)
    assert published_through(date(2026, 10, 16)) == date(2026, 9, 30)
    assert published_through(date(2026, 1, 2)) == date(2025, 11, 30)


def _cache(raw: Path, source_id: str, last_month: str) -> None:
    sha = "ab" * 32
    folder = raw / source_id / sha[:16]
    folder.mkdir(parents=True)
    (raw / source_id / "index.json").write_text(json.dumps({"county@current": sha}))
    (folder / "County_x.csv").write_text(f"RegionID,RegionName,2026-07-31,{last_month}\n")


def test_a_source_behind_what_zillow_published_is_due(tmp_path: Path) -> None:
    _cache(tmp_path, "zillow_zhvi", "2026-09-30")
    _cache(tmp_path, "zillow_zori", "2026-08-31")
    assert held_through(tmp_path, "zillow_zhvi") == date(2026, 9, 30)
    assert due(tmp_path, date(2026, 10, 16)) == {"zillow_zori": date(2026, 8, 31)}
    assert due(tmp_path, date(2026, 10, 9)) == {}


def test_a_source_never_handed_in_is_due(tmp_path: Path) -> None:
    assert due(tmp_path, date(2026, 10, 16)) == {"zillow_zhvi": None, "zillow_zori": None}
