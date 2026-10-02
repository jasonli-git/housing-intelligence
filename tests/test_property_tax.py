"""Property tax: what you'd actually pay (Milestone 37).

The parcel lookup's boundary — never an owner — and the county effective tax rate,
weighted by equalized valuation. Pure where it can be; the warehouse checks skip
without one.
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pytest

from hip.config import get_settings
from hip.parcels import COLUMNS
from hip.sources.base import ReleaseRef
from hip.sources.nj_equalized import NjEqualizedAdapter, district_count, districts
from hip.sources.nj_modiv import FIELDS, OWNER_FIELDS, ModivAdapter


def test_no_owner_field_is_ever_requested() -> None:
    """The parcel layer publishes the owner's mailing address for 3 million parcels; the
    request names its fields, and none of them is an owner's (ARCHITECTURE #289)."""
    assert not set(FIELDS) & OWNER_FIELDS
    [ref] = ModivAdapter().refs()
    asked = ref.url.split("outFields=")[1].split(",")
    assert asked == list(FIELDS)
    assert not set(asked) & OWNER_FIELDS


def test_a_parcel_file_carries_no_owner_and_no_sale() -> None:
    """MOD-IV's sale price has no usability flag (#179), and an owner is never here."""
    for column in COLUMNS:
        assert not any(
            word in column for word in ("owner", "mail", "deed", "sale", "zip")
        )


def test_a_wider_parcel_request_misses_the_cache() -> None:
    """The fields are in the ref's URL, which the raw cache compares (#214): before
    Milestone 37 adding five fields was answered from the old download."""
    [ref] = ModivAdapter().refs()
    assert "PROP_LOC" in ref.url and "PCLBLOCK" in ref.url


# --- The Table of Equalized Valuations. ----------------------------------------------


def _ref(year: str) -> ReleaseRef:
    return ReleaseRef("nj_equalized", "tev", year, "https://x")


def _table(year: int, extra: list[str] | None = None) -> str:
    lines = [
        f"{n // 30 + 1:02d}{n % 30 + 1:02d} TOWN {n} BORO 1,000,000 50.00 2,000,000 0 0 "
        f"2,000,000"
        for n in range(district_count(year))
    ]
    return "\n".join(["Table of Equalized Valuations", *lines, *(extra or [])])


def test_a_table_must_list_every_district_of_its_year() -> None:
    assert len(districts(_table(2024), _ref("2024"))) == 564
    assert len(districts(_table(2019), _ref("2019"))) == 565
    with pytest.raises(ValueError, match="layout"):
        districts(_table(2024).rsplit("\n", 1)[0], _ref("2024"))


def test_a_blank_column_still_reads_the_equalized_value_last() -> None:
    """2019's table leaves a column blank for eight districts."""
    text = _table(2019).replace(
        "0101 TOWN 0 BORO 1,000,000 50.00 2,000,000 0 0 2,000,000",
        "0101 TOWN 0 BORO 1,000,000 50.00 2,000,000 0 2,100,000",
    )
    row = next(r for r in districts(text, _ref("2019")) if r["cd_code"] == "0101")
    assert row["equalized_value"] == 2_100_000


def test_an_equalized_value_below_true_value_means_a_misread() -> None:
    text = _table(2024).replace(
        "0101 TOWN 0 BORO 1,000,000 50.00 2,000,000 0 0 2,000,000",
        "0101 TOWN 0 BORO 1,000,000 50.00 2,000,000 0 0 900",
    )
    with pytest.raises(ValueError, match="below"):
        districts(text, _ref("2024"))


def test_pine_valley_is_counted_until_its_merger() -> None:
    assert (district_count(2020), district_count(2021)) == (565, 564)
    assert NjEqualizedAdapter().refs()[0].vintage == "2018"


# --- The county rate, against the warehouse. -----------------------------------------


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    path = get_settings().duckdb_path
    if not Path(path).exists():
        pytest.skip("no DuckDB warehouse; run `hip stage`")
    connection = duckdb.connect(str(path), read_only=True)
    staged = {
        r[0]
        for r in connection.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main_staging'"
        ).fetchall()
    }
    if "stg_nj_county_tax_rates" not in staged:
        pytest.skip("the county tax rates are not staged")
    return connection


def test_a_county_rate_is_weighted_by_equalized_value(con) -> None:  # type: ignore[no-untyped-def]
    """Hudson's 2025 rate is its towns' 2025 rates weighted by the 2024 table — the year
    whose ratio those rates were set at — and is not their plain average."""
    parquet = get_settings().parquet_dir / "nj_equalized" / "2024" / "tev.parquet"
    towns = con.execute(
        f"""
        SELECT r.value, t.equalized_value
        FROM main_staging.stg_nj_tax_rates r
        JOIN main_staging.stg_nj_municipal_codes i ON i.geoid = r.geoid
        JOIN read_parquet('{parquet}') t ON t.cd_code = i.identifier
        WHERE r.metric_id = 'nj_effective_tax_rate' AND year(r.period_end) = 2025
          AND r.geoid LIKE '34017%'
        """
    ).fetchall()
    assert len(towns) == 12
    weighted = sum(v * w for v, w in towns) / sum(w for _, w in towns)
    plain = sum(v for v, _ in towns) / len(towns)
    [(staged,)] = con.execute(
        """
        SELECT value FROM main_staging.stg_nj_county_tax_rates
        WHERE geoid = '34017' AND year(period_end) = 2025
        """
    ).fetchall()
    assert staged == pytest.approx(weighted)
    assert staged != pytest.approx(plain, rel=0.01)


def test_one_towns_parcel_file(tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    """Hoboken's file, exported for real: every row one of `COLUMNS`, nothing else."""
    from hip.parcels import export
    from hip.warehouse.db import get_engine, probe

    if not probe().migrated:
        pytest.skip("needs a migrated warehouse")
    parquet = get_settings().parquet_dir / "nj_modiv"
    landed = duckdb.sql(
        f"DESCRIBE SELECT * FROM read_parquet('{parquet}/*/statewide.parquet')"
    ).fetchall()
    if "PROP_LOC" not in {row[0] for row in landed}:
        pytest.skip("MOD-IV landed before Milestone 37's fields")
    [written] = export(
        tmp_path,
        parquet_dir=get_settings().parquet_dir,
        engine=get_engine(),
        tax_year=2024,
        towns={"3401732250"},
    )
    data = json.loads((tmp_path / written.path).read_text())
    assert data["municipality"] == "Hoboken"
    assert data["columns"] == list(COLUMNS)
    assert all(len(row) == len(COLUMNS) for row in data["parcels"])
    assert written.parcels > 1000
