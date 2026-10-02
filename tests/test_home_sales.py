"""How homes change hands (Milestone 36): the four guardrails ROADMAP set, and reading the
state's revaluation lists.

1. Property classes stay separate: only usable one- to four-family (class 2) deeds count.
2. A parcel is not a dwelling unit: a count says sales or parcels, never homes or units.
3. A county median is never a median of town medians: it comes from the deeds.
4. A rising median is labelled as possibly a change in *which* homes sold.

The first and third are checked against the staged warehouse and skip without one.
"""

from __future__ import annotations

import statistics
from pathlib import Path

import duckdb
import pytest

from hip.config import get_settings, load_metrics
from hip.packets.caveats import caveats_for, scoped_caveats
from hip.sources.base import ReleaseRef
from hip.sources.nj_revaluations import NjRevaluationsAdapter, towns

HUDSON = "34017"


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
    if "stg_nj_sr1a" not in staged:
        pytest.skip("SR1A is not staged")
    return connection


def _latest(con: duckdb.DuckDBPyConnection, metric: str, geoid: str) -> tuple:
    return con.execute(
        "SELECT value, period_start, period_end FROM main_staging.stg_nj_sr1a "
        "WHERE metric_id = ? AND geoid = ? ORDER BY period_end DESC LIMIT 1",
        [metric, geoid],
    ).fetchone()


def _deeds(con: duckdb.DuckDBPyConnection, start: object, end: object) -> list[tuple]:
    """Usable deeds in a window, every class, with the town each is in."""
    parquet = get_settings().parquet_dir / "nj_sr1a" / "*" / "sales.parquet"
    return con.execute(
        f"""
        SELECT property_class, verified_sales_price::bigint AS price,
               lpad(county_code, 2, '0') || lpad(district_code, 2, '0') AS cd
        FROM read_parquet('{parquet}')
        WHERE un_type = 'U' AND regexp_matches(verified_sales_price, '^[0-9]+$')
          AND verified_sales_price::bigint > 0
          AND regexp_matches(deed_date, '^[0-9]{{6}}$')
          AND lpad(county_code, 2, '0') = '09'
          AND make_date(2000 + substr(deed_date, 1, 2)::int,
                        substr(deed_date, 3, 2)::int, 1) BETWEEN ? AND ?
        """,
        [start, end],
    ).fetchall()


def test_a_county_median_is_the_deeds_median_of_one_to_four_family_sales(con) -> None:  # type: ignore[no-untyped-def]
    """Guardrails 1 and 3, on Hudson County (CD county code 09)."""
    value, start, end = _latest(con, "sr1a_median_sale_price", HUDSON)
    deeds = _deeds(con, start, end)
    class_two = [price for cls, price, _ in deeds if cls.strip() == "2"]
    assert value == pytest.approx(statistics.median(class_two), rel=0.002)
    # The other classes are there to be mixed in, and are not.
    assert any(cls.strip() != "2" for cls, _, _ in deeds)
    every_class = statistics.median(price for _, price, _ in deeds)
    assert every_class != pytest.approx(value, rel=0.002)
    # Nor is it the median of its towns' medians.
    by_town: dict[str, list[int]] = {}
    for cls, price, cd in deeds:
        if cls.strip() == "2":
            by_town.setdefault(cd, []).append(price)
    of_medians = statistics.median(statistics.median(v) for v in by_town.values())
    assert of_medians != pytest.approx(value, rel=0.002)


def test_counts_are_of_sales_and_parcels_never_of_homes_or_units() -> None:
    """Guardrail 2: a deed sells a parcel, which may hold up to four homes."""
    metrics = load_metrics()
    for metric_id in ("sr1a_sales_count", "modiv_residential_parcels"):
        label = metrics[metric_id].label.lower()
        assert "sale" in label or "parcel" in label, metric_id
        assert "unit" not in label and "dwelling" not in label, metric_id


def test_a_sale_price_says_it_may_be_a_change_in_which_homes_sold() -> None:
    """Guardrail 4, on the median, its change and every other sale-price figure."""
    for metric in (
        "sr1a_median_sale_price",
        "sr1a_median_sale_price_12m",
        "sr1a_median_price_per_sqft",
    ):
        caveats = caveats_for(level="municipality", metric_ids=[metric])
        assert any("pricier homes changed hands" in c for c in caveats), metric
    scoped = scoped_caveats(level="county", metric_ids=["sr1a_median_sale_price"])
    composition = [c for c in scoped if "pricier homes" in c.text]
    assert composition and "never from town medians" in composition[0].text


def test_a_twelve_month_median_needs_fifty_sales_and_others_twenty(con) -> None:  # type: ignore[no-untyped-def]
    counts = con.execute(
        """
        SELECT metric_id, count(*) FROM main_staging.stg_nj_sr1a
        WHERE level = 'municipality' GROUP BY 1
        """
    ).fetchall()
    by_metric = dict(counts)
    assert by_metric["sr1a_median_sale_price_12m"] < by_metric["sr1a_median_sale_price"]
    low = con.execute(
        """
        SELECT count(*) FROM main_staging.stg_nj_sr1a
        WHERE metric_id = 'sr1a_sales_count' AND value < 20
        """
    ).fetchone()
    assert low == (0,)


# --- Reading the revaluation lists. Pure: text in, rows out. -------------------------


def _ref(year: str = "2025") -> ReleaseRef:
    return ReleaseRef("nj_revaluations", "approved", year, "https://x")


def test_a_list_reads_towns_and_skips_its_headings() -> None:
    text = "\n".join(
        [
            "2025 Approved PROPERTY ADMINISTRATION",
            "2025 DIRECTOR'S TABLE OF EQUALIZED VALUATIONS",
            "CD Code County Municipality",
            "0201 Bergen Allendale Borough",
            "0501 Cape May Avalon Borough",
            "2004 Union Elizabeth City",
        ]
    )
    rows = towns(text, _ref())
    assert [(r["cd_code"], r["county"], r["municipality"]) for r in rows] == [
        ("0201", "Bergen", "Allendale Borough"),
        ("0501", "Cape May", "Avalon Borough"),
        ("2004", "Union", "Elizabeth City"),
    ]
    assert {r["tax_year"] for r in rows} == {2025}


def test_a_misspelled_county_is_still_read() -> None:
    """2025's list prints Seaside Heights under "Ocena"; an exact match dropped it."""
    [row] = towns("1527 Ocena Seaside Heights Borough", _ref())
    assert (row["cd_code"], row["county"]) == ("1527", "Ocean")


def test_a_code_in_the_wrong_county_is_refused() -> None:
    """A code's first two digits are its county, so a mismatch means the layout moved."""
    with pytest.raises(ValueError, match="layout"):
        towns("0201 Union Elizabeth City", _ref())


def test_a_list_with_no_towns_is_an_error() -> None:
    with pytest.raises(ValueError, match="no towns"):
        NjRevaluationsAdapter.pdf_records("2025 Approved\nnothing here", _ref())


def test_every_published_year_is_asked_for() -> None:
    refs = NjRevaluationsAdapter().refs()
    assert [r.vintage for r in refs][0] == "2017"
    assert refs[-1].url.endswith("/2026RevalList.pdf")
