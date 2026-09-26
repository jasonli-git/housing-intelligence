"""`Discovery` crossing into the warehouse, and the freshness report built from it.

Milestone 27: the API may import only `warehouse` and `packets` from the pipeline
(ARCHITECTURE #6), so `Discovery` — written to `data/raw/<source>/releases.json` at
acquisition (Milestone 26) — has to be loaded into Postgres before a public freshness
page can read it. `load_discoveries` is that load; `build_report` is the read.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.config import Source
from hip.sources.base import Discovery, write_discovery
from hip.warehouse.db import get_engine, probe
from hip.warehouse.discoveries import load_discoveries
from hip.warehouse.freshness import (
    FreshnessReport,
    _changelog_version,
    _status,
    build_report,
)

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


def _source(**overrides: object) -> Source:
    defaults: dict[str, object] = {
        "name": "Test Source",
        "publisher": "Test Publisher",
        "license": "Public domain",
        "url": "https://example.invalid/",
        "cadence": "annual",
        "adapter": "hip.sources.fake:FakeAdapter",
        "fallback": "There is none; this is a test.",
    }
    return Source(**{**defaults, **overrides})


@pytest.fixture
def clean_test_source():
    """A source_id no real pipeline uses, cleaned from `source_discoveries` after."""
    source_id = "test_freshness_source"
    yield source_id
    with get_engine().begin() as conn:
        conn.execute(
            text("DELETE FROM source_discoveries WHERE source_id = :s"), {"s": source_id}
        )


def test_status_reads_outcome_and_pending_before_defaulting_to_current() -> None:
    confirmed = {"outcome": "confirmed", "pending": None}
    pending = {"outcome": "confirmed", "pending": "2027"}
    unreachable = {"outcome": "unreachable", "pending": None}
    # Unreachable wins even if a pending release was also recorded on an earlier check:
    # the platform could not ask this time, so "pending" is not confirmed either.
    both = {"outcome": "unreachable", "pending": "2027"}

    assert _status(None) == "not_tracked"
    assert _status(confirmed) == "current"
    assert _status(pending) == "pending"
    assert _status(unreachable) == "unreachable"
    assert _status(both) == "unreachable"


def test_changelog_version_reads_the_newest_heading(tmp_path: Path) -> None:
    changelog = tmp_path / "CHANGELOG.md"
    changelog.write_text(
        "# Changelog\n\n## [0.22.0] — 2026-09-23\n\nStuff.\n\n## [0.21.4] — 2026-09-22\n"
    )
    assert _changelog_version(changelog) == "0.22.0"


def test_changelog_version_falls_back_when_the_file_is_missing(tmp_path: Path) -> None:
    from hip import __version__

    assert _changelog_version(tmp_path / "nope.md") == __version__


def test_load_discoveries_round_trips_through_the_warehouse(
    tmp_path: Path, clean_test_source: str
) -> None:
    write_discovery(
        tmp_path,
        Discovery(
            source_id=clean_test_source,
            newest="2026",
            checked_at=datetime(2026, 9, 23, 12, 0, tzinfo=UTC),
            outcome="confirmed",
            published="2026-01-15",
        ),
    )

    written = load_discoveries(get_engine(), tmp_path, [clean_test_source])
    assert written == 1

    with get_engine().connect() as conn:
        row = (
            conn.execute(
                text(
                    "SELECT newest, outcome, published, checked_at "
                    "FROM source_discoveries WHERE source_id = :s"
                ),
                {"s": clean_test_source},
            )
            .mappings()
            .one()
        )
    assert (row["newest"], row["outcome"], row["published"]) == (
        "2026",
        "confirmed",
        "2026-01-15",
    )


def test_load_discoveries_skips_a_source_with_no_record(
    tmp_path: Path, clean_test_source: str
) -> None:
    """No `discover()`, no file, no row — never a row of nulls (see this module's own
    header comment in `hip.warehouse.freshness`)."""
    written = load_discoveries(get_engine(), tmp_path, [clean_test_source])
    assert written == 0

    with get_engine().connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM source_discoveries WHERE source_id = :s"),
            {"s": clean_test_source},
        ).first()
    assert exists is None


def test_load_discoveries_upserts_rather_than_duplicates(
    tmp_path: Path, clean_test_source: str
) -> None:
    write_discovery(
        tmp_path,
        Discovery(
            source_id=clean_test_source,
            newest="2025",
            checked_at=datetime(2026, 1, 1, tzinfo=UTC),
            outcome="confirmed",
        ),
    )
    load_discoveries(get_engine(), tmp_path, [clean_test_source])

    write_discovery(
        tmp_path,
        Discovery(
            source_id=clean_test_source,
            newest="2026",
            checked_at=datetime(2026, 9, 23, tzinfo=UTC),
            outcome="confirmed",
        ),
    )
    load_discoveries(get_engine(), tmp_path, [clean_test_source])

    with get_engine().connect() as conn:
        rows = conn.execute(
            text("SELECT newest FROM source_discoveries WHERE source_id = :s"),
            {"s": clean_test_source},
        ).fetchall()
    assert [r[0] for r in rows] == ["2026"]


def test_build_report_reads_known_sources_correctly() -> None:
    """Against the real, live-loaded warehouse: today's manual verification, pinned."""
    with Session(get_engine()) as session:
        report = build_report(
            session,
            sources={
                "census_tiger": _source(name="TIGER", fallback="Pinned on purpose."),
                "hud_fmr": _source(name="Fair Market Rents", cadence="annual"),
            },
        )

    assert isinstance(report, FreshnessReport)
    by_id = {s.source_id: s for s in report.sources}
    # TIGER's adapter never implements discover() (ARCHITECTURE #206): no row exists.
    assert by_id["census_tiger"].status == "not_tracked"
    assert by_id["census_tiger"].checked_at is None
    # HUD FMR: FY2027 was published but does not take effect until 2026-10-01.
    fmr = by_id["hud_fmr"]
    assert fmr.status == "pending"
    assert fmr.pending == "2027"
    assert fmr.pending_from == "2026-10-01"


def test_build_report_never_reads_a_sources_notes_field() -> None:
    """MOD-IV's real next-publication date is known only from a private email and must
    stay off every public page — never even reach `Source.notes` in the first place."""
    modiv = _source(
        name="MOD-IV",
        notes="Next publication expected February 2027, per a private email.",
    )
    with Session(get_engine()) as session:
        report = build_report(session, sources={"nj_modiv": modiv})
    body = report.model_dump_json()
    assert "February" not in body
    assert "private email" not in body


def test_report_carries_the_changelog_version_not_the_package_metadata(
    tmp_path: Path,
) -> None:
    changelog = tmp_path / "CHANGELOG.md"
    changelog.write_text("## [9.9.9] — 2026-01-01\n")
    with Session(get_engine()) as session:
        report = build_report(session, sources={}, changelog_path=changelog)
    assert report.site_version == "9.9.9"
