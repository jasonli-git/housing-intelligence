"""The SR1A sales adapter, the fixed-width lander, and the median it produces.

The adapter and lander halves run anywhere: a synthetic 663-byte record proves the
offsets are cut correctly without downloading 88MB of deeds. The warehouse half checks
what actually landed.
"""

from __future__ import annotations

import hashlib
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.landing.tabular import land_fixed_width, parquet_path
from hip.sources.base import Release, ReleaseRef
from hip.sources.nj_sr1a import FIELDS, RECORD_BYTES, Sr1aAdapter, vintages
from hip.warehouse.db import get_engine, probe


def _record(**values: str) -> str:
    """One 663-byte SR1A record with the named fields set and the rest blank."""
    row = [" "] * RECORD_BYTES
    offsets = {name: (start, length) for name, start, length in FIELDS}
    for name, value in values.items():
        start, length = offsets[name]
        assert len(value) <= length, f"{name} takes {length} bytes, got {len(value)}"
        row[start - 1 : start - 1 + len(value)] = value
    return "".join(row)


def test_every_published_year_is_offered_once() -> None:
    refs = Sr1aAdapter().refs()
    assert [r.vintage for r in refs] == list(vintages())
    assert len({r.key for r in refs}) == len(refs), "two years share a cache key"


def test_the_year_in_progress_is_named_differently_from_a_closed_year() -> None:
    """A closed year is immutable; the year-to-date file is not, and says so."""
    urls = {r.vintage: r.url for r in Sr1aAdapter().refs()}
    assert urls["2025"].endswith("/Sales2025.zip")
    assert urls["2026ytd"].endswith("/YTDSR1A2026.zip")
    assert Sr1aAdapter().default_vintage.endswith("ytd")


def test_a_single_vintage_can_be_asked_for_alone() -> None:
    refs = Sr1aAdapter().refs(vintage="2023")
    assert len(refs) == 1 and refs[0].url.endswith("/Sales2023.zip")


def _release(tmp_path: Path, *records: str) -> Release:
    """A zipped fixed-width file, the way the Division publishes one."""
    raw = tmp_path / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    archive = raw / "Sales2025.zip"
    body = "\r\n".join(records) + "\r\n"
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("Sales2025.txt", body)
    return Release(
        ref=ReleaseRef(
            source_id="nj_sr1a",
            layer="sales",
            vintage="2025",
            url="https://example.invalid/Sales2025.zip",
        ),
        path=archive,
        sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
        size_bytes=archive.stat().st_size,
        fetched_at=datetime.now(UTC),
    )


def test_the_lander_cuts_each_field_at_its_published_offset(tmp_path: Path) -> None:
    release = _release(
        tmp_path,
        _record(
            county_code="01",
            district_code="02",
            un_type="U",
            verified_sales_price="000450000",
            deed_date="250715",
            property_class="2",
        ),
    )
    table = land_fixed_width(release, Sr1aAdapter, parquet_dir=tmp_path / "parquet")
    with duckdb.connect() as con:
        row = con.execute(
            "SELECT county_code, district_code, un_type, verified_sales_price, "
            "deed_date, property_class FROM read_parquet(?)",
            [str(table.path)],
        ).fetchone()
    assert row == ("01", "02", "U", "000450000", "250715", "2")


def test_the_lander_never_transcodes_the_parties_to_a_sale(tmp_path: Path) -> None:
    """Grantor and grantee are 178 of the 663 bytes and must not reach Parquet.

    The privacy boundary is that `FIELDS` does not name them, so this asserts the
    boundary holds rather than that the current field list happens to omit them —
    adding a name column to `FIELDS` should fail here.
    """
    release = _release(tmp_path, _record(county_code="01", district_code="02"))
    table = land_fixed_width(release, Sr1aAdapter, parquet_dir=tmp_path / "parquet")
    with duckdb.connect() as con:
        columns = {
            d[0].lower()
            for d in con.execute(
                "SELECT * FROM read_parquet(?) LIMIT 0", [str(table.path)]
            ).description
        }
    forbidden = {"grantor", "grantee", "street", "zip", "property_location", "name"}
    assert not {c for c in columns if any(f in c for f in forbidden)}


def test_landing_a_format_the_adapter_declares_no_layout_for_is_refused(
    tmp_path: Path,
) -> None:
    class Layoutless(Sr1aAdapter):
        fixed_width_fields = ()

    with pytest.raises(ValueError, match="no fixed_width_fields"):
        land_fixed_width(
            _release(tmp_path, _record(county_code="01")),
            Layoutless,
            parquet_dir=tmp_path / "parquet",
        )


def test_the_parquet_path_separates_vintages(tmp_path: Path) -> None:
    """Seven archives must not land on one path, as `current`-vintage sources do."""
    paths = {
        parquet_path(
            Release(
                ref=ref,
                path=tmp_path / "x",
                sha256="",
                size_bytes=0,
                fetched_at=datetime.now(UTC),
            ),
            tmp_path,
        )
        for ref in Sr1aAdapter().refs()
    }
    assert len(paths) == len(Sr1aAdapter().refs())


warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@warehouse
def test_the_sale_price_is_observed_at_every_level() -> None:
    with Session(get_engine()) as session:
        rows = dict(
            session.execute(
                text("""
                SELECT r.level, count(*)
                FROM fact_metric_observation f
                JOIN regions r ON r.region_id = f.region_id
                WHERE f.metric_id = 'sr1a_median_sale_price'
                GROUP BY r.level
                """)
            ).all()
        )
    assert rows.get("county") == 105, rows
    assert rows.get("municipality", 0) > 2_000, rows


@warehouse
def test_no_window_claims_a_period_the_deeds_do_not_reach() -> None:
    """A window ending in the year in progress ends at the newest deed, not 31 Dec."""
    with Session(get_engine()) as session:
        beyond = session.execute(
            text("""
                SELECT count(*) FROM fact_metric_observation
                WHERE metric_id = 'sr1a_median_sale_price'
                  AND period_end > current_date
            """)
        ).scalar_one()
    assert beyond == 0
