"""Floating-point noise is not a revision (migration 0032, ARCHITECTURE #334).

Read against the migrated warehouse: the rule is a SQL function the trigger and the
`/changes` view share, so it is tested where it runs.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text

from hip.warehouse.db import get_engine, probe

pytestmark = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)


@pytest.mark.parametrize(
    ("old", "new", "noise"),
    [
        # A sum taken in another order: the last digits of a share.
        (0.3141592653589793, 0.31415926535897937, True),
        # Within one part in a billion of a dollar figure.
        (1_234_567.0, 1_234_567.0001, True),
        # The smallest real revision held on 2026-10-07 moved by 1.8 parts per million.
        (100.0, 100.000177, False),
        (0.0, 0.0001, False),
        # A withdrawal is always a revision.
        (5.0, None, False),
        (None, 5.0, False),
    ],
)
def test_noise_is_a_change_under_one_part_in_a_billion(
    old: float | None, new: float | None, noise: bool
) -> None:
    with get_engine().connect() as conn:
        found = conn.execute(
            text("SELECT revision_is_noise(CAST(:old AS float8), CAST(:new AS float8))"),
            {"old": old, "new": new},
        ).scalar_one()
    assert found is noise


def test_changes_reads_the_revisions_without_the_noise() -> None:
    with get_engine().connect() as conn:
        hidden = conn.execute(
            text(
                "SELECT count(*) FROM fact_revision "
                "WHERE revision_is_noise(old_value, new_value)"
            )
        ).scalar_one()
        total = conn.execute(text("SELECT count(*) FROM fact_revision")).scalar_one()
        shown = conn.execute(
            text("SELECT count(*) FROM fact_revision_shown")
        ).scalar_one()
    assert shown == total - hidden
