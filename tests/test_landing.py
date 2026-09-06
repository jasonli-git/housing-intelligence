"""Landing: transcoding a fetched file to Parquet, and knowing when to redo it.

The property under test is narrow and was broken in a way nothing caught for a month:
a second release of the *same* ref must replace the Parquet the first one produced.
`parquet_path` keys on the release's vintage, and for every source whose vintage is the
literal string `current` — Zillow, FHFA, FRED, BLS, MOD-IV — successive releases share
one path. Skipping on `out.exists()` therefore pinned the warehouse to whichever release
landed first, silently, while `source_releases` went on recording the new ones.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from hip.landing.tabular import land_csv, needs_landing, parquet_path
from hip.sources.base import Release, ReleaseRef


def _release(tmp_path: Path, body: str, name: str = "county.csv") -> Release:
    path = tmp_path / "raw" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)
    return Release(
        ref=ReleaseRef(
            source_id="zillow_zhvi",
            layer="county",
            # The literal string that made this a defect: not a date, and shared by
            # every release of this ref.
            vintage="current",
            url="https://example.invalid/county.csv",
        ),
        path=path,
        sha256=hashlib.sha256(body.encode()).hexdigest(),
        size_bytes=len(body),
        fetched_at=datetime.now(UTC),
    )


JUNE = "RegionID,StateName,2026-05-31,2026-06-30\n1,NJ,100,110\n"
JULY = "RegionID,StateName,2026-05-31,2026-06-30,2026-07-31\n1,NJ,100,110,120\n"


def _columns(path: Path) -> list[str]:
    con = duckdb.connect()
    try:
        return [
            c[0]
            for c in con.execute(
                f"SELECT * FROM read_parquet('{path}') LIMIT 0"
            ).description
        ]
    finally:
        con.close()


def test_a_new_release_of_the_same_ref_replaces_the_parquet(tmp_path: Path) -> None:
    """The regression. Zillow's August release carried a `2026-07-31` column that the
    raw tier stored correctly and the warehouse never saw, because the destination path
    already existed from the previous month's run."""
    parquet_dir = tmp_path / "parquet"

    june = _release(tmp_path, JUNE)
    land_csv(june, parquet_dir=parquet_dir)
    assert "2026-07-31" not in _columns(parquet_path(june, parquet_dir))

    july = _release(tmp_path, JULY, name="county-july.csv")
    landed = land_csv(july, parquet_dir=parquet_dir)

    assert parquet_path(july, parquet_dir) == parquet_path(june, parquet_dir), (
        "both releases must map to one path, or this test is not exercising the bug"
    )
    assert "2026-07-31" in _columns(landed.path)


def test_re_landing_an_unchanged_release_is_skipped(tmp_path: Path) -> None:
    """The skip is worth keeping: re-transcoding 1.1GB of MOD-IV on every pipeline run
    is a real cost. It just has to answer the right question."""
    parquet_dir = tmp_path / "parquet"
    release = _release(tmp_path, JUNE)
    land_csv(release, parquet_dir=parquet_dir)
    out = parquet_path(release, parquet_dir)
    before = out.stat().st_mtime_ns

    land_csv(release, parquet_dir=parquet_dir)
    assert out.stat().st_mtime_ns == before


def test_needs_landing_compares_content_not_existence(tmp_path: Path) -> None:
    parquet_dir = tmp_path / "parquet"
    june = _release(tmp_path, JUNE)
    out = parquet_path(june, parquet_dir)

    assert needs_landing(june, out, overwrite=False) is True  # nothing there yet
    land_csv(june, parquet_dir=parquet_dir)
    assert needs_landing(june, out, overwrite=False) is False  # same bytes
    assert needs_landing(june, out, overwrite=True) is True  # forced

    july = _release(tmp_path, JULY, name="county-july.csv")
    assert needs_landing(july, out, overwrite=False) is True  # different bytes


def test_a_parquet_with_no_stamp_is_rebuilt_once(tmp_path: Path) -> None:
    """Everything landed before the stamp existed has no record of what produced it.
    Rebuilding once is the only safe reading, and it makes every later run trustworthy."""
    parquet_dir = tmp_path / "parquet"
    release = _release(tmp_path, JUNE)
    land_csv(release, parquet_dir=parquet_dir)
    out = parquet_path(release, parquet_dir)

    out.with_suffix(".parquet.src").unlink()
    assert needs_landing(release, out, overwrite=False) is True
