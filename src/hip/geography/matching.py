"""Resolve source-native geography keys to warehouse regions.

Sources identify places three different ways, and only one of them is unambiguous:

- **county** — Zillow ships `StateCodeFIPS` and `MunicipalCodeFIPS`, which concatenate
  to the 5-digit county GEOID. Exact, no judgment involved.
- **zip** — the region name *is* the ZIP code, joined to the ZCTA geoid. Exact as a
  string match, but see the caveat below: ZIPs and ZCTAs are different objects.
- **municipality** — Zillow's "City" level carries no FIPS at all, only a name and a
  county name. This is the hard case and the reason this module exists.

The municipality matcher normalizes legal-form suffixes (`Township`, `Borough`, …) and
requires the county to agree. Anything that still resolves to more than one municipality
is **rejected, not guessed**: New Jersey has co-located pairs such as Chatham Borough
and Chatham Township inside one county, and a name+county key genuinely cannot separate
them. Silently picking one would put a real number on the wrong place, which is worse
than having no number — the platform's value is that a figure can be trusted.

Every resolved row records how it was resolved, so a downstream reader can filter to
exact matches without re-deriving this logic.
"""

from __future__ import annotations

from dataclasses import dataclass

import duckdb

OBSERVATION_TABLE = "stg_metric_observation"
REJECT_TABLE = "stg_match_reject"

# Legal forms that appear in one source's name for a place and not the other's.
# Anchored at the end so "Township of Nowhere" is untouched and "City Island" is safe.
SUFFIX_PATTERN = r"\s+(Township|Twp|Borough|Boro|City|Town|Village|CDP)$"


def _norm(column: str) -> str:
    return f"lower(trim(regexp_replace({column}, '{SUFFIX_PATTERN}', '', 'i')))"


@dataclass(frozen=True)
class MatchCounts:
    """Resolution outcome per layer. The numbers a coverage report is built from."""

    matched: dict[str, int]
    rejected: dict[str, int]
    regions_covered: dict[str, int]

    @property
    def total_matched(self) -> int:
        return sum(self.matched.values())

    @property
    def total_rejected(self) -> int:
        return sum(self.rejected.values())


def build_observations(
    con: duckdb.DuckDBPyConnection,
    *,
    staged_models: dict[str, str],
    staging_schema: str,
    regions_table: str = "stg_regions",
) -> MatchCounts:
    """Resolve every staged observation to a region, or record why it could not be.

    ``staged_models`` maps a dbt model name to the ``metric_id`` its values represent.
    """
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE muni_lookup AS
        SELECT m.geoid,
               {_norm("m.name")}  AS name_key,
               {_norm("c.name")}  AS county_key
        FROM {regions_table} m
        JOIN {regions_table} c
          ON c.level = 'county' AND c.geoid = m.parent_geoid
        WHERE m.level = 'municipality'
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE county_lookup AS
        SELECT geoid FROM {regions_table} WHERE level = 'county'
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE zip_lookup AS
        SELECT geoid FROM {regions_table} WHERE level = 'zip'
        """
    )

    union = "\nUNION ALL\n".join(
        f"""
        SELECT '{metric_id}' AS metric_id, source_id, layer, region_name,
               county_name, fips_key, period_start, value
        FROM {staging_schema}.{model}
        """
        for model, metric_id in staged_models.items()
    )
    con.execute(f"CREATE OR REPLACE TEMP TABLE staged AS {union}")

    # Ambiguity has two sides, and both are fatal.
    #
    # Lookup side: two municipalities share a normalized name within one county —
    # Chatham Borough and Chatham Township in Morris.
    con.execute(
        """
        CREATE OR REPLACE TEMP TABLE muni_ambiguous AS
        SELECT name_key, county_key
        FROM muni_lookup
        GROUP BY 1, 2 HAVING count(*) > 1
        """
    )
    # Source side: two distinct source geographies normalize onto one key. Stripping
    # legal-form suffixes merges genuinely different places — Boonton Town and Boonton
    # Township, Egg Harbor City and Egg Harbor Township — which are separate
    # municipalities with different home values. Without this the loader produced two
    # conflicting values for the same (region, metric, month) and the gate blocked it.
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE source_ambiguous AS
        SELECT name_key, county_key FROM (
            SELECT DISTINCT
                   {_norm("region_name")} AS name_key,
                   {_norm("replace(county_name, ' County', '')")} AS county_key,
                   region_name
            FROM staged WHERE layer = 'city'
        )
        GROUP BY 1, 2 HAVING count(*) > 1
        """
    )

    con.execute(f"DROP TABLE IF EXISTS {OBSERVATION_TABLE}")
    con.execute(
        f"""
        CREATE TABLE {OBSERVATION_TABLE} AS
        -- County: exact FIPS.
        SELECT s.metric_id, c.geoid, 'county' AS level,
               date_trunc('month', s.period_start)::date AS period_start,
               (date_trunc('month', s.period_start) + INTERVAL 1 MONTH
                    - INTERVAL 1 DAY)::date AS period_end,
               s.value, s.source_id, s.layer, 'fips' AS match_method
        FROM staged s
        JOIN county_lookup c ON c.geoid = s.fips_key
        WHERE s.layer = 'county'

        UNION ALL

        -- ZIP: the region name is the code itself.
        SELECT s.metric_id, z.geoid, 'zip',
               date_trunc('month', s.period_start)::date,
               (date_trunc('month', s.period_start) + INTERVAL 1 MONTH
                    - INTERVAL 1 DAY)::date,
               s.value, s.source_id, s.layer, 'zip_code'
        FROM staged s
        JOIN zip_lookup z ON z.geoid = s.region_name
        WHERE s.layer = 'zip'

        UNION ALL

        -- Municipality: normalized name plus county, unambiguous only.
        SELECT s.metric_id, m.geoid, 'municipality',
               date_trunc('month', s.period_start)::date,
               (date_trunc('month', s.period_start) + INTERVAL 1 MONTH
                    - INTERVAL 1 DAY)::date,
               s.value, s.source_id, s.layer, 'name_county'
        FROM staged s
        JOIN muni_lookup m
          ON m.name_key = {_norm("s.region_name")}
         AND m.county_key = {_norm("replace(s.county_name, ' County', '')")}
        WHERE s.layer = 'city'
          AND NOT EXISTS (
              SELECT 1 FROM muni_ambiguous a
              WHERE a.name_key = m.name_key AND a.county_key = m.county_key
          )
          AND NOT EXISTS (
              SELECT 1 FROM source_ambiguous sa
              WHERE sa.name_key = m.name_key AND sa.county_key = m.county_key
          )
        """
    )

    _build_rejects(con)
    return _count(con)


def _build_rejects(con: duckdb.DuckDBPyConnection) -> None:
    """One row per unresolved source *geography*, with the reason it went unresolved.

    Collapsing to distinct geographies first is what makes this cheap: New Jersey has
    roughly 2,500 source geographies across both indexes but 333,000 observations, and
    resolution is a property of the geography, not of the month. Testing each
    observation against the resolved table instead was quadratic and exhausted memory.

    It is also the more useful report — 300 unmatched months for one township is one
    problem to fix, not 300.
    """
    name_key = _norm("region_name")
    county_key = _norm("replace(county_name, ' County', '')")

    con.execute(f"DROP TABLE IF EXISTS {REJECT_TABLE}")
    con.execute(
        f"""
        CREATE TABLE {REJECT_TABLE} AS
        WITH geo AS (
            SELECT source_id, layer, region_name, county_name, fips_key,
                   {name_key}   AS name_key,
                   {county_key} AS county_key,
                   count(*)     AS observations
            FROM staged
            GROUP BY 1, 2, 3, 4, 5, 6, 7
        ),
        flagged AS (
            SELECT g.*,
                   EXISTS (SELECT 1 FROM county_lookup c WHERE c.geoid = g.fips_key)
                       AS county_hit,
                   EXISTS (SELECT 1 FROM zip_lookup z WHERE z.geoid = g.region_name)
                       AS zip_hit,
                   EXISTS (SELECT 1 FROM muni_lookup m
                           WHERE m.name_key = g.name_key
                             AND m.county_key = g.county_key) AS muni_hit,
                   EXISTS (SELECT 1 FROM muni_ambiguous a
                           WHERE a.name_key = g.name_key
                             AND a.county_key = g.county_key) AS muni_ambiguous,
                   EXISTS (SELECT 1 FROM source_ambiguous sa
                           WHERE sa.name_key = g.name_key
                             AND sa.county_key = g.county_key) AS source_ambiguous
            FROM geo g
        )
        SELECT source_id, layer, region_name, county_name, observations,
               CASE
                 WHEN layer = 'county' THEN 'county fips not in scope'
                 WHEN layer = 'zip'    THEN 'zip code has no ZCTA in scope'
                 WHEN muni_ambiguous
                   THEN 'ambiguous: name and county match multiple municipalities'
                 WHEN source_ambiguous
                   THEN 'ambiguous: several source geographies share this name after'
                        || ' dropping the legal form (e.g. Town vs Township)'
                 ELSE 'no municipality with this name in this county'
                      || ' (usually a census-designated place inside a township)'
               END AS reason
        FROM flagged
        WHERE (layer = 'county' AND NOT county_hit)
           OR (layer = 'zip'    AND NOT zip_hit)
           OR (layer = 'city'   AND (NOT muni_hit OR muni_ambiguous OR source_ambiguous))
        """
    )


def _count(con: duckdb.DuckDBPyConnection) -> MatchCounts:
    matched = {
        str(level): int(n)
        for level, n in con.execute(
            f"SELECT level, count(*) FROM {OBSERVATION_TABLE} GROUP BY 1"
        ).fetchall()
    }
    covered = {
        str(level): int(n)
        for level, n in con.execute(
            f"SELECT level, count(DISTINCT geoid) FROM {OBSERVATION_TABLE} GROUP BY 1"
        ).fetchall()
    }
    rejected = {
        str(layer): int(n)
        for layer, n in con.execute(
            f"SELECT layer, count(*) FROM {REJECT_TABLE} GROUP BY 1"
        ).fetchall()
    }
    return MatchCounts(matched=matched, rejected=rejected, regions_covered=covered)
