"""The gate between staging and the warehouse.

A failed load is worse than a skipped one: the warehouse keeps serving the previous
release, which is stale but coherent, whereas a half-sane load is confidently wrong.
This module answers "is this release sane" once, and `hip load` refuses to run when the
answer is no.

Checks are declarative so the report names the failing rule rather than a line number,
and every check reports its count even when it passes — a report that only appears on
failure gives no way to notice a metric quietly losing half its coverage.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from hip.geography.matching import OBSERVATION_TABLE, REJECT_TABLE

# A home value index below this is a data error, not a cheap house. Deliberately wide:
# the gate is here to catch a file whose shape changed, not to second-guess Zillow.
VALUE_BOUNDS = {
    "zhvi_sfr": (1_000.0, 100_000_000.0),
    "zori_all": (100.0, 100_000.0),
    "acs_median_hh_income": (5_000.0, 500_000.0),
    "acs_median_gross_rent": (200.0, 10_000.0),
    "acs_population": (0.0, 50_000_000.0),
    "acs_median_home_value": (10_000.0, 10_000_000.0),
    "acs_renter_cost_burden": (0.0, 1.0),
    "permits_total_units": (0.0, 1_000_000.0),
    "fhfa_hpi": (1.0, 10_000.0),
    "mortgage_rate_30y": (0.5, 25.0),
    "unemployment_rate": (0.0, 60.0),
    # Net migration is a signed difference and can legitimately be large and negative.
    "net_migration_returns": (-1_000_000.0, 1_000_000.0),
    # MOD-IV aggregates. An assessment is not a market value, so the floor is well below
    # anything Zillow would report: municipalities that have not revalued in decades
    # carry assessments at a fraction of market.
    "modiv_median_assessed_value": (1_000.0, 100_000_000.0),
    "modiv_residential_parcels": (0.0, 1_000_000.0),
    # New Jersey's oldest housing predates the republic; the ceiling is the near future,
    # because MOD-IV records a year of construction for permitted-but-unbuilt parcels.
    "modiv_median_year_built": (1600.0, 2100.0),
    "modiv_median_lot_acres": (0.0, 10_000.0),
    "modiv_vacant_land_share": (0.0, 1.0),
    "modiv_multifamily_share": (0.0, 1.0),
}

# Below this share of a level's regions, something structural has broken — a renamed
# source column, a changed geography scheme — rather than genuine coverage thinning.
MIN_COVERAGE = {"county": 0.90, "zip": 0.50, "municipality": 0.40}

# Range checks exist to catch a file whose shape changed, not to second-guess a
# publisher's noisy small-area estimates. ACS genuinely reports a $99 median gross rent
# for Alexandria Township, where the renter sample is a handful of households — real,
# published, and useless, but not a parsing bug. Blocking a 330,000-row load over two
# such rows makes the gate an obstacle instead of a safeguard; ignoring a third of a
# metric makes it decoration. So a metric fails only once out-of-range rows exceed both
# an absolute floor and a share of that metric's rows.
OUT_OF_RANGE_ALLOWANCE = 5
OUT_OF_RANGE_SHARE = 0.001


@dataclass
class Check:
    name: str
    passed: bool
    count: int
    detail: str


@dataclass
class Report:
    run_at: str
    passed: bool
    observations: int
    checks: list[Check]

    def failures(self) -> list[Check]:
        return [c for c in self.checks if not c.passed]


def run_checks(
    con: duckdb.DuckDBPyConnection, *, regions_table: str = "stg_regions"
) -> Report:
    """Run every gate check against the staged observations."""
    checks: list[Check] = []

    total = int(
        con.execute(f"SELECT count(*) FROM {OBSERVATION_TABLE}").fetchone()[0]  # type: ignore[index]
    )
    checks.append(
        Check(
            "observations_present",
            total > 0,
            total,
            "staged observations to load" if total else "nothing staged; run `hip stage`",
        )
    )

    duplicates = int(
        con.execute(
            f"""
            SELECT count(*) FROM (
                SELECT geoid, level, metric_id, period_start
                FROM {OBSERVATION_TABLE}
                GROUP BY 1, 2, 3, 4 HAVING count(*) > 1
            )
            """
        ).fetchone()[0]  # type: ignore[index]
    )
    checks.append(
        Check(
            "no_duplicate_observations",
            duplicates == 0,
            duplicates,
            "one value per (region, metric, period)",
        )
    )

    orphans = int(
        con.execute(
            f"""
            SELECT count(*) FROM {OBSERVATION_TABLE} o
            -- The US region is created by migration 0004, not by the TIGER-derived
            -- staging table, so a national observation has no stg_regions row.
            WHERE o.level <> 'nation'
              AND NOT EXISTS (
                SELECT 1 FROM {regions_table} r
                WHERE r.geoid = o.geoid AND r.level = o.level
            )
            """
        ).fetchone()[0]  # type: ignore[index]
    )
    checks.append(
        Check(
            "every_observation_has_a_region",
            orphans == 0,
            orphans,
            "observations referencing a region that does not exist",
        )
    )

    for metric_id, (low, high) in VALUE_BOUNDS.items():
        row = con.execute(
            f"""
            SELECT
                count(*) FILTER (WHERE value < ? OR value > ?),
                count(*)
            FROM {OBSERVATION_TABLE} WHERE metric_id = ?
            """,
            [low, high, metric_id],
        ).fetchone()
        out_of_range, present = (int(row[0]), int(row[1])) if row else (0, 0)
        allowed = max(OUT_OF_RANGE_ALLOWANCE, int(present * OUT_OF_RANGE_SHARE))
        checks.append(
            Check(
                f"{metric_id}_within_range",
                out_of_range <= allowed,
                out_of_range,
                f"of {present:,} outside [{low:,.0f}, {high:,.0f}]; "
                f"tolerance {allowed:,}",
            )
        )

    for level, minimum in MIN_COVERAGE.items():
        row = con.execute(
            f"""
            SELECT
                (SELECT count(DISTINCT geoid) FROM {OBSERVATION_TABLE} WHERE level = ?),
                (SELECT count(*) FROM {regions_table} WHERE level = ?)
            """,
            [level, level],
        ).fetchone()
        covered, available = (int(row[0]), int(row[1])) if row else (0, 0)
        share = covered / available if available else 0.0
        checks.append(
            Check(
                f"{level}_coverage",
                share >= minimum,
                covered,
                f"{covered}/{available} regions ({share:.0%}), floor {minimum:.0%}",
            )
        )

    rejected = int(
        con.execute(f"SELECT count(*) FROM {REJECT_TABLE}").fetchone()[0]  # type: ignore[index]
    )
    checks.append(
        Check(
            "unresolved_geographies_recorded",
            True,  # informational: unresolved geographies are expected, not a failure
            rejected,
            "source geographies with no warehouse region; see source_match_reject",
        )
    )

    return Report(
        run_at=datetime.now(UTC).isoformat(),
        passed=all(c.passed for c in checks),
        observations=total,
        checks=checks,
    )


def write_report(report: Report, reports_dir: Path) -> Path:
    """Persist the report. Every run writes one, passing or failing."""
    reports_dir.mkdir(parents=True, exist_ok=True)
    stamp = report.run_at.replace(":", "").replace("-", "")[:15]
    path = reports_dir / f"{stamp}.json"
    path.write_text(json.dumps(asdict(report), indent=2) + "\n")
    return path
