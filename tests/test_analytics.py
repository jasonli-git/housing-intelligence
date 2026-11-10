"""The analytics rebuild, and the invariant that makes a packet hash mean something.

`hip analyze` is documented as idempotent, and until 2026-09-06 it was not: every run
minted a fresh `hip_derived` release stamped with the wall clock, repointed the three
affordability metrics at it, and so moved the hash of every packet that quotes them —
which is every county packet. The consequences were downstream and quiet. Each stored
explanation was marked stale by the next pipeline run whether or not a number had moved
(`region_explanations.packet_sha256`), all 21 committed county reports showed a
provenance diff with no figure behind it, and the releases accumulated one per run
forever.

These tests clone DDL into a disposable schema and seed synthetic histories. They
never rebuild the served warehouse. The pair is shared (`two_rebuilds`); `slow` keeps
the two-run checks in `make test-all`, while the margin checks also run in `make test`.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from hip.analytics.compute import rebuild
from hip.packets import build_packet, packet_hash
from hip.warehouse.db import get_engine, probe
from tests.warehouse_scratch import scratch_warehouse, seed_analytics

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")

DERIVED_RELEASES = text(
    "SELECT release_id FROM source_releases WHERE source_id = 'hip_derived' "
    "ORDER BY release_id"
)
# "Referenced" includes `fact_revision` (ARCHITECTURE #199): a release the facts have
# moved past still traces a revision's old or new value. Counting only facts made this
# fail the first time derived figures moved after a refresh — Milestone 26's, on
# 2026-09-23 — over a release the rebuild keeps on purpose.
ORPHANS = text(
    """
    SELECT count(*) FROM source_releases sr
    WHERE sr.source_id = 'hip_derived'
      AND NOT EXISTS (
          SELECT 1 FROM fact_metric_observation f WHERE f.release_id = sr.release_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM fact_revision r
          WHERE r.old_release_id = sr.release_id OR r.new_release_id = sr.release_id
      )
    """
)


@pytest.fixture(scope="module")
def analytics_engine() -> Iterator[Engine]:
    with scratch_warehouse(get_engine()) as engine:
        seed_analytics(engine)
        rebuild(engine)
        yield engine


@pytest.fixture(scope="module")
def county_id(analytics_engine: Engine) -> int:
    with Session(analytics_engine) as session:
        region_id = session.execute(
            text(
                """
                SELECT c.region_id FROM fact_metric_change c
                JOIN regions r ON r.region_id = c.region_id
                WHERE r.level = 'county' AND c.metric_id = 'price_to_income'
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
    if region_id is None:
        pytest.skip("no derived analytics; run the pipeline through `hip analyze`")
    return int(region_id)


def _derived_releases(engine: Engine) -> list[int]:
    with engine.connect() as conn:
        return [int(row[0]) for row in conn.execute(DERIVED_RELEASES)]


@pytest.fixture(scope="module")
def two_rebuilds(county_id: int, analytics_engine: Engine) -> dict[str, object]:
    """Two rebuilds over unchanged data, observed once for the four tests below.

    Both runs operate on the same synthetic facts, not the API's loaded tables.
    """
    engine = analytics_engine
    rebuild(engine)
    with Session(engine) as session:
        first = build_packet(session, county_id, "5y")
    releases_before = _derived_releases(engine)

    rebuild(engine)
    with Session(engine) as session:
        second = build_packet(session, county_id, "5y")
    with engine.connect() as conn:
        orphans = int(conn.execute(ORPHANS).scalar_one())
    return {
        "releases_before": releases_before,
        "releases_after": _derived_releases(engine),
        "hash_before": packet_hash(first),
        "hash_after": packet_hash(second),
        "packet": second,
        "orphans": orphans,
    }


@pytest.mark.slow
def test_a_rebuild_over_unchanged_data_reuses_its_release(
    two_rebuilds: dict[str, object],
) -> None:
    """Content-addressed, like any other release (ARCHITECTURE #10, #73)."""
    assert two_rebuilds["releases_after"] == two_rebuilds["releases_before"], (
        "an analyze run over unchanged data minted a new hip_derived release"
    )


@pytest.mark.slow
def test_a_rebuild_over_unchanged_data_leaves_the_packet_hash_alone(
    two_rebuilds: dict[str, object],
) -> None:
    """The property `region_explanations.packet_sha256` depends on entirely."""
    assert two_rebuilds["hash_before"] == two_rebuilds["hash_after"], (
        "the packet hash moved with no change in the data"
    )


@pytest.mark.slow
def test_the_packet_carries_no_run_timestamp(two_rebuilds: dict[str, object]) -> None:
    """A derived release names its content, not the minute it was computed.

    The regression this catches is specific: `vintage` used to be
    `to_char(now(), 'YYYY-MM-DD"T"HH24MISS')`, so a packet's own sources table carried
    a wall clock while ARCHITECTURE #44 claimed it carried none.
    """
    packet = two_rebuilds["packet"]
    derived = [s for s in packet.sources if s.source_id == "hip_derived"]  # type: ignore[attr-defined]
    if not derived:
        pytest.skip("this region quotes no derived metric")
    for source in derived:
        assert not source.vintage.startswith("20"), (
            f"hip_derived vintage {source.vintage!r} looks like a timestamp"
        )


@pytest.mark.slow
def test_the_rebuild_leaves_no_unreferenced_derived_releases(
    two_rebuilds: dict[str, object],
) -> None:
    """A release no fact cites records that a run happened and nothing else."""
    assert two_rebuilds["orphans"] == 0


# ------------------------------------------------------ margins of error (M28) ---


def _rows(engine: Engine, sql: str, **params: object) -> list[dict[str, object]]:
    with Session(engine) as session:
        return [dict(r) for r in session.execute(text(sql), params).mappings()]


def test_rank_ranges_follow_the_census_test_for_a_significant_difference(
    analytics_engine: Engine,
) -> None:
    """Recomputed in Python for one group, from the stored values and margins: a region
    moves ahead of another only where |difference| > sqrt(m1^2 + m2^2)."""
    rows = _rows(
        analytics_engine,
        """
        SELECT rr.region_id, rr.value, rr.rank, rr.rank_best, rr.rank_worst, rr."of",
               (SELECT f.margin_of_error FROM fact_metric_observation f
                WHERE f.region_id = rr.region_id AND f.metric_id = rr.metric_id
                ORDER BY f.period_end DESC LIMIT 1) AS margin
        FROM region_rankings rr
        WHERE rr.metric_id = 'acs_median_hh_income' AND rr.level = 'county'
          AND rr.basis = 'value'
        """,
    )
    if not rows:
        pytest.skip("no ACS income rankings")
    for a in rows:
        better = worse = 0
        for b in rows:
            if b["region_id"] == a["region_id"]:
                continue
            gap = (float(a["margin"]) ** 2 + float(b["margin"]) ** 2) ** 0.5  # type: ignore[arg-type]
            # Higher income is the better end for this metric.
            better += float(b["value"]) - float(a["value"]) > gap  # type: ignore[arg-type]
            worse += float(a["value"]) - float(b["value"]) > gap  # type: ignore[arg-type]
        assert (a["rank_best"], a["rank_worst"]) == (1 + better, int(a["of"]) - worse)  # type: ignore[call-overload]
        assert a["rank_best"] <= a["rank"] <= a["rank_worst"]  # type: ignore[operator]


def test_only_ranks_built_on_margins_get_a_range(analytics_engine: Engine) -> None:
    rows = _rows(
        analytics_engine,
        """
        SELECT m.source_id,
               count(*) FILTER (WHERE rr.rank_best IS NOT NULL) AS ranged,
               count(*) AS ranks
        FROM region_rankings rr JOIN metrics m USING (metric_id)
        GROUP BY 1
        """,
    )
    by_source = {r["source_id"]: r for r in rows}
    if "census_acs" not in by_source:
        pytest.skip("no ACS rankings")
    assert by_source["census_acs"]["ranged"] == by_source["census_acs"]["ranks"]
    # A Zillow or MOD-IV rank is a place, as it always was.
    for source in ("zillow_zhvi", "nj_modiv"):
        if source in by_source:
            assert by_source[source]["ranged"] == 0


def test_a_region_with_no_known_margin_cannot_be_placed(analytics_engine: Engine) -> None:
    """A Census special code leaves the margin unknown: the whole cohort is its range."""
    rows = _rows(
        analytics_engine,
        """
        SELECT rr.rank_best, rr.rank_worst, rr."of"
        FROM region_rankings rr
        JOIN LATERAL (
            SELECT f.margin_of_error FROM fact_metric_observation f
            WHERE f.region_id = rr.region_id AND f.metric_id = rr.metric_id
            ORDER BY f.period_end DESC LIMIT 1
        ) o ON true
        WHERE rr.basis = 'value' AND rr.metric_id = 'acs_median_gross_rent'
          AND o.margin_of_error IS NULL
        """,
    )
    if not rows:
        pytest.skip("every rent carries a margin")
    assert all((r["rank_best"], r["rank_worst"]) == (1, r["of"]) for r in rows)


def test_a_derived_ratio_carries_the_survey_income_margin(
    analytics_engine: Engine,
) -> None:
    """price_to_income's margin is its value times the income's relative margin: the
    home value index publishes no sampling error of its own."""
    rows = _rows(
        analytics_engine,
        """
        SELECT d.value, d.margin_of_error, i.value AS income, i.margin_of_error AS im
        FROM fact_metric_observation d
        JOIN fact_metric_observation i
          ON i.region_id = d.region_id AND i.period_start = d.period_start
         AND i.metric_id = 'acs_median_hh_income'
        WHERE d.metric_id = 'price_to_income' AND i.margin_of_error IS NOT NULL
        LIMIT 50
        """,
    )
    if not rows:
        pytest.skip("no ratios with a margined income")
    for r in rows:
        expected = float(r["value"]) * float(r["im"]) / float(r["income"])  # type: ignore[arg-type]
        assert r["margin_of_error"] == pytest.approx(expected, abs=2e-6)


def test_a_change_carries_the_census_margin_for_a_ratio(analytics_engine: Engine) -> None:
    rows = _rows(
        analytics_engine,
        """
        SELECT c.start_value, c.end_value, c.pct_change_margin,
               s.margin_of_error AS sm, e.margin_of_error AS em
        FROM fact_metric_change c
        JOIN fact_metric_observation s
          ON s.region_id = c.region_id AND s.metric_id = c.metric_id
         AND s.period_end = c.window_start
        JOIN fact_metric_observation e
          ON e.region_id = c.region_id AND e.metric_id = c.metric_id
         AND e.period_end = c.window_end
        WHERE c.metric_id = 'acs_median_home_value' AND c."window" = '5y'
          AND s.margin_of_error IS NOT NULL AND e.margin_of_error IS NOT NULL
        LIMIT 50
        """,
    )
    if not rows:
        pytest.skip("no margined five-year changes")
    for r in rows:
        start, end = float(r["start_value"]), float(r["end_value"])  # type: ignore[arg-type]
        expected = (
            100
            * (float(r["em"]) ** 2 + (end / start) ** 2 * float(r["sm"]) ** 2) ** 0.5  # type: ignore[arg-type]
            / abs(start)
        )
        assert r["pct_change_margin"] == pytest.approx(expected)


def test_a_survey_change_is_never_shorter_than_its_label(
    analytics_engine: Engine,
) -> None:
    """#282: a ZCTA's first edition is 2020, so a five-year change to 2024 would have
    been measured from 2020 under the 400-day tolerance — four years labelled as five,
    over two editions sharing a year of sample. Survey windows may not start late."""
    rows = _rows(
        analytics_engine,
        """
        SELECT count(*) AS n
        FROM fact_metric_change c JOIN metrics m USING (metric_id)
        WHERE (m.record_type = 'survey' OR m.metric_id = ANY(:on_income))
          AND c."window" IN ('1y', '3y', '5y', '10y')
          AND c.window_end - c.window_start < CASE c."window"
                WHEN '1y' THEN 365 WHEN '3y' THEN 1095
                WHEN '5y' THEN 1826 ELSE 3652 END - 31
        """,
        on_income=["price_to_income", "rent_to_income", "fmr_to_income"],
    )
    assert rows[0]["n"] == 0
    zip_five = _rows(
        analytics_engine,
        """
        SELECT count(*) AS n
        FROM fact_metric_change c JOIN regions r USING (region_id)
        JOIN metrics m USING (metric_id)
        WHERE r.level = 'zip' AND c."window" = '5y'
          AND (m.source_id = 'census_acs' OR m.metric_id = 'price_to_income')
        """,
    )
    assert zip_five[0]["n"] == 0


@pytest.fixture(scope="module")
def edition_engine() -> Iterator[Engine]:
    """Rents for three counties and three ZIPs, with one figure in each level that the
    newest-edition rule (counties) or the margin rule (ZIPs) leaves out of the ranking."""
    with scratch_warehouse(get_engine()) as engine:
        seed_analytics(engine)
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM fact_metric_observation WHERE metric_id <> 'zhvi_sfr'")
            )
            conn.execute(
                text(
                    """
                    WITH placed AS (
                        SELECT region_id, level,
                               row_number() OVER (
                                   PARTITION BY level ORDER BY region_id
                               ) AS n
                        FROM regions
                    )
                    INSERT INTO fact_metric_observation
                      (region_id, metric_id, period_start, period_end, value,
                       release_id, match_method, margin_of_error)
                    SELECT p.region_id, 'acs_median_gross_rent',
                           make_date(y - 4, 1, 1), make_date(y, 12, 31),
                           1000 + p.n * 100,
                           (SELECT min(release_id) FROM source_releases), 'fips',
                           CASE WHEN p.level = 'zip' AND p.n = 3 THEN 700 ELSE 50 END
                    FROM placed p CROSS JOIN generate_series(2023, 2024) y
                    -- The third county's newest figure is from the 2019-2023 survey.
                    WHERE NOT (p.level = 'county' AND p.n = 3 AND y = 2024)
                    """
                )
            )
        rebuild(engine)
        yield engine


def test_a_survey_ranks_one_edition_and_no_figure_mostly_margin(
    edition_engine: Engine,
) -> None:
    from hip.api.routers.analytics import _left_out

    ranked = _rows(
        edition_engine,
        """
        SELECT r.level::text AS level, count(*) AS n, max(k.of) AS of
        FROM region_rankings k JOIN regions r USING (region_id)
        WHERE k.metric_id = 'acs_median_gross_rent' AND k.basis = 'value'
        GROUP BY 1
        """,
    )
    assert {r["level"]: (r["n"], r["of"]) for r in ranked} == {
        "county": (2, 2),
        "zip": (2, 2),
    }
    with Session(edition_engine) as session:
        county = _left_out(session, "acs_median_gross_rent", "county")
        zip_ = _left_out(session, "acs_median_gross_rent", "zip")
    assert [(r.reason, r.period_end.year) for r in county] == [("older", 2023)]
    assert [(r.reason, r.margin_of_error) for r in zip_] == [("uncertain", 700)]
    # An index is not a survey: every county's newest month is ranked, whatever its date.
    zillow = _rows(
        edition_engine,
        "SELECT count(*) AS n FROM region_rankings k JOIN regions r USING (region_id) "
        "WHERE k.metric_id = 'zhvi_sfr' AND k.basis = 'value' AND r.level = 'county'",
    )
    assert zillow[0]["n"] == 3
