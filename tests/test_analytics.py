"""The analytics rebuild, and the invariant that makes a packet hash mean something.

`hip analyze` is documented as idempotent, and until 2026-09-06 it was not: every run
minted a fresh `hip_derived` release stamped with the wall clock, repointed the three
affordability metrics at it, and so moved the hash of every packet that quotes them —
which is every county packet. The consequences were downstream and quiet. Each stored
explanation was marked stale by the next pipeline run whether or not a number had moved
(`region_explanations.packet_sha256`), all 21 committed county reports showed a
provenance diff with no figure behind it, and the releases accumulated one per run
forever.

These tests need a loaded warehouse and rebuild it twice, which is the only way to
observe the property: it is a statement about two runs, not about one. The pair is run
once and shared (`two_rebuilds`), and the tests are marked `slow`: `make test` leaves
them out, `make test-all` runs them.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.analytics.compute import rebuild
from hip.packets import build_packet, packet_hash
from hip.warehouse.db import get_engine, probe

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
def county_id() -> int:
    with Session(get_engine()) as session:
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


def _derived_releases() -> list[int]:
    with get_engine().connect() as conn:
        return [int(row[0]) for row in conn.execute(DERIVED_RELEASES)]


@pytest.fixture(scope="module")
def two_rebuilds(county_id: int) -> dict[str, object]:
    """Two rebuilds over unchanged data, observed once for the four tests below.

    Each rebuild takes about three and a half minutes (the rank ranges, TODO.md), and
    the four tests had run six between them, 20 of the suite's 24 minutes. Every
    property they check is a statement about this one pair of runs.
    """
    engine = get_engine()
    rebuild(engine)
    with Session(engine) as session:
        first = build_packet(session, county_id, "5y")
    releases_before = _derived_releases()

    rebuild(engine)
    with Session(engine) as session:
        second = build_packet(session, county_id, "5y")
    with engine.connect() as conn:
        orphans = int(conn.execute(ORPHANS).scalar_one())
    return {
        "releases_before": releases_before,
        "releases_after": _derived_releases(),
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


def _rows(sql: str, **params: object) -> list[dict[str, object]]:
    with Session(get_engine()) as session:
        return [dict(r) for r in session.execute(text(sql), params).mappings()]


def test_rank_ranges_follow_the_census_test_for_a_significant_difference() -> None:
    """Recomputed in Python for one group, from the stored values and margins: a region
    moves ahead of another only where |difference| > sqrt(m1^2 + m2^2)."""
    rows = _rows(
        """
        SELECT rr.region_id, rr.value, rr.rank, rr.rank_best, rr.rank_worst, rr."of",
               (SELECT f.margin_of_error FROM fact_metric_observation f
                WHERE f.region_id = rr.region_id AND f.metric_id = rr.metric_id
                ORDER BY f.period_end DESC LIMIT 1) AS margin
        FROM region_rankings rr
        WHERE rr.metric_id = 'acs_median_hh_income' AND rr.level = 'county'
          AND rr.basis = 'value'
        """
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


def test_only_ranks_built_on_margins_get_a_range() -> None:
    rows = _rows(
        """
        SELECT m.source_id,
               count(*) FILTER (WHERE rr.rank_best IS NOT NULL) AS ranged,
               count(*) AS ranks
        FROM region_rankings rr JOIN metrics m USING (metric_id)
        GROUP BY 1
        """
    )
    by_source = {r["source_id"]: r for r in rows}
    if "census_acs" not in by_source:
        pytest.skip("no ACS rankings")
    assert by_source["census_acs"]["ranged"] == by_source["census_acs"]["ranks"]
    # A Zillow or MOD-IV rank is a place, as it always was.
    for source in ("zillow_zhvi", "nj_modiv"):
        if source in by_source:
            assert by_source[source]["ranged"] == 0


def test_a_region_with_no_known_margin_cannot_be_placed() -> None:
    """A Census special code leaves the margin unknown: the whole cohort is its range."""
    rows = _rows(
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
        """
    )
    if not rows:
        pytest.skip("every rent carries a margin")
    assert all((r["rank_best"], r["rank_worst"]) == (1, r["of"]) for r in rows)


def test_a_derived_ratio_carries_the_survey_income_margin() -> None:
    """price_to_income's margin is its value times the income's relative margin: the
    home value index publishes no sampling error of its own."""
    rows = _rows(
        """
        SELECT d.value, d.margin_of_error, i.value AS income, i.margin_of_error AS im
        FROM fact_metric_observation d
        JOIN fact_metric_observation i
          ON i.region_id = d.region_id AND i.period_start = d.period_start
         AND i.metric_id = 'acs_median_hh_income'
        WHERE d.metric_id = 'price_to_income' AND i.margin_of_error IS NOT NULL
        LIMIT 50
        """
    )
    if not rows:
        pytest.skip("no ratios with a margined income")
    for r in rows:
        expected = float(r["value"]) * float(r["im"]) / float(r["income"])  # type: ignore[arg-type]
        assert r["margin_of_error"] == pytest.approx(expected, abs=2e-6)


def test_a_change_carries_the_census_margin_for_a_ratio() -> None:
    rows = _rows(
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
        """
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


def test_a_survey_change_is_never_shorter_than_its_label() -> None:
    """#282: a ZCTA's first edition is 2020, so a five-year change to 2024 would have
    been measured from 2020 under the 400-day tolerance — four years labelled as five,
    over two editions sharing a year of sample. Survey windows may not start late."""
    rows = _rows(
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
        """
        SELECT count(*) AS n
        FROM fact_metric_change c JOIN regions r USING (region_id)
        JOIN metrics m USING (metric_id)
        WHERE r.level = 'zip' AND c."window" = '5y'
          AND (m.source_id = 'census_acs' OR m.metric_id = 'price_to_income')
        """
    )
    assert zip_five[0]["n"] == 0
