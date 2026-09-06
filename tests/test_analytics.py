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
observe the property: it is a statement about two runs, not about one.
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
ORPHANS = text(
    """
    SELECT count(*) FROM source_releases sr
    WHERE sr.source_id = 'hip_derived'
      AND NOT EXISTS (
          SELECT 1 FROM fact_metric_observation f WHERE f.release_id = sr.release_id
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


def test_a_rebuild_over_unchanged_data_reuses_its_release() -> None:
    """Content-addressed, like any other release (ARCHITECTURE #10, #73)."""
    engine = get_engine()
    rebuild(engine)
    before = _derived_releases()

    rebuild(engine)

    assert _derived_releases() == before, (
        "an analyze run over unchanged data minted a new hip_derived release"
    )


def test_a_rebuild_over_unchanged_data_leaves_the_packet_hash_alone(
    county_id: int,
) -> None:
    """The property `region_explanations.packet_sha256` depends on entirely."""
    engine = get_engine()
    rebuild(engine)
    with Session(engine) as session:
        before = packet_hash(build_packet(session, county_id, "5y"))

    rebuild(engine)
    with Session(engine) as session:
        after = packet_hash(build_packet(session, county_id, "5y"))

    assert before == after, "the packet hash moved with no change in the data"


def test_the_packet_carries_no_run_timestamp(county_id: int) -> None:
    """A derived release names its content, not the minute it was computed.

    The regression this catches is specific: `vintage` used to be
    `to_char(now(), 'YYYY-MM-DD"T"HH24MISS')`, so a packet's own sources table carried
    a wall clock while ARCHITECTURE #44 claimed it carried none.
    """
    rebuild(get_engine())
    with Session(get_engine()) as session:
        packet = build_packet(session, county_id, "5y")

    derived = [s for s in packet.sources if s.source_id == "hip_derived"]
    if not derived:
        pytest.skip("this region quotes no derived metric")
    for source in derived:
        assert not source.vintage.startswith("20"), (
            f"hip_derived vintage {source.vintage!r} looks like a timestamp"
        )


def test_the_rebuild_leaves_no_unreferenced_derived_releases() -> None:
    """A release no fact cites records that a run happened and nothing else."""
    rebuild(get_engine())

    with get_engine().connect() as conn:
        assert int(conn.execute(ORPHANS).scalar_one()) == 0
