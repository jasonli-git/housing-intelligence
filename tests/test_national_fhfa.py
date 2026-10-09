"""National HPI selectors and source-use metadata, without network or warehouse writes."""

from pathlib import Path

import duckdb
from jinja2 import Environment

from hip.config import REPO_ROOT, load_sources


def test_monthly_national_hpi_does_not_mix_geographies_frequencies_or_flavors(
    tmp_path: Path,
) -> None:
    folder = tmp_path / "fhfa_hpi" / "current"
    folder.mkdir(parents=True)
    con = duckdb.connect()
    con.execute("""create table payload(
        level varchar, frequency varchar, place_id varchar, hpi_flavor varchar,
        yr integer, period integer, index_sa double, index_nsa double)""")
    con.executemany(
        "insert into payload values (?,?,?,?,?,?,?,?)",
        [
            (
                "USA or Census Division",
                "monthly",
                "USA",
                "purchase-only",
                2026,
                12,
                110,
                999,
            ),
            (
                "USA or Census Division",
                "quarterly",
                "USA",
                "purchase-only",
                2026,
                4,
                222,
                999,
            ),
            (
                "USA or Census Division",
                "monthly",
                "DV_MA",
                "purchase-only",
                2026,
                12,
                333,
                999,
            ),
            (
                "USA or Census Division",
                "monthly",
                "USA",
                "all-transactions",
                2026,
                12,
                444,
                999,
            ),
            ("State", "quarterly", "NJ", "purchase-only", 2026, 4, 555, 999),
            (
                "USA or Census Division",
                "monthly",
                "USA",
                "purchase-only",
                2026,
                11,
                None,
                999,
            ),
        ],
    )
    con.execute(f"copy payload to '{folder / 'master.parquet'}' (format parquet)")
    variables = {
        "parquet_dir": str(tmp_path),
        "states": "'NJ'",
        "state_fips_pairs": [["NJ", "34"]],
    }
    template = (REPO_ROOT / "dbt/models/staging/stg_fhfa_hpi.sql").read_text()
    sql = (
        Environment()
        .from_string(template)
        .render(config=lambda **_: "", var=variables.__getitem__)
    )
    result = con.execute(sql)
    columns = [column[0] for column in result.description]
    rows = [dict(zip(columns, row, strict=True)) for row in result.fetchall()]
    national = [row for row in rows if row["metric_id"] == "fhfa_hpi_us_monthly"]
    assert len(national) == 1
    row = national[0]
    assert (row["geoid"], row["level"], row["value"], row["match_method"]) == (
        "US",
        "nation",
        110,
        "national",
    )
    assert str(row["period_start"]) == "2026-12-01"
    assert str(row["period_end"]) == "2026-12-31"
    assert (row["source_id"], row["release_layer"], row["release_vintage"]) == (
        "fhfa_hpi",
        "master",
        "current",
    )
    assert next(row for row in rows if row["metric_id"] == "fhfa_hpi")["value"] == 555
    con.close()


def test_both_fhfa_sources_carry_the_required_non_endorsement_notice() -> None:
    sources = load_sources()
    notice = "This product uses FHFA data but is neither endorsed nor certified by FHFA."
    for source_id in ("fhfa_hpi", "fhfa_hpi_county"):
        assert notice in sources[source_id].notices
        assert sources[source_id].terms_url.endswith("website-privacy-policy")
    assert sources["fhfa_hpi"].cadence == "monthly"
