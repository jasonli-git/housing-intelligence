"""What the warehouse costs on disk, per storage tier and per state.

An infrastructure leaf like `hip.config` and `hip.duck`: importable from anywhere,
holds no pipeline logic (ARCHITECTURE #23).

This exists because the two tools already measuring the platform answer a different
question. `mac-sitrep` profiles `make pipeline` end to end and reports wall clock, CPU,
peak RAM, and *I/O volume* — bytes moved while a command runs. The README's Resource
Requirements block is its output. What neither it nor anything else reports is
*footprint*: how many bytes the platform is still occupying after the run finishes, and
how that total divides between the three storage tiers and the states inside them.

The distinction matters exactly once, and it is now: Milestone 14 multiplies New Jersey
by nine, and the number that gets multiplied is footprint, not throughput. Postgres
makes the gap concrete — it lives inside Docker's disk image, so it is invisible both to
sitrep's process accounting and to any `du` run against `data/`, and it is the tier that
grows fastest with geography because geometry is stored per region.

Degrades rather than fails when Postgres is unreachable, matching `warehouse.db.probe`:
the filesystem tiers are still worth reporting when the database is simply not running,
and a capacity question should not require `docker compose up`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from hip.config import Settings
from hip.warehouse.db import get_engine


@dataclass(frozen=True)
class Tier:
    """One filesystem storage tier."""

    name: str
    path: Path
    bytes: int
    exists: bool


@dataclass(frozen=True)
class Table:
    """One warehouse table. ``rows`` is the planner's estimate, not a count.

    `pg_class.reltuples` is what `ANALYZE` last recorded, so it can lag a fresh load and
    reads -1 on a table that has never been analyzed. Exact counts would mean one query
    per table built from names read out of the catalog; the per-state figures below are
    exact and are the ones that get multiplied, so the estimate is enough here and is
    labelled as one wherever it is printed.
    """

    name: str
    bytes: int
    rows: int | None


@dataclass(frozen=True)
class StateRows:
    """Exact region and observation counts for one state — the multiplicand."""

    state_code: str
    regions: int
    observations: int


@dataclass(frozen=True)
class Footprint:
    """Everything `hip footprint` reports, with the database part optional."""

    tiers: list[Tier]
    database_bytes: int | None = None
    tables: list[Table] = field(default_factory=list)
    states: list[StateRows] = field(default_factory=list)
    database_error: str | None = None

    @property
    def filesystem_bytes(self) -> int:
        return sum(tier.bytes for tier in self.tiers)

    @property
    def total_bytes(self) -> int:
        return self.filesystem_bytes + (self.database_bytes or 0)


def directory_bytes(path: Path) -> int:
    """Apparent size of every regular file under ``path``.

    Apparent size (`st_size`), not allocated blocks, so this reads a little lower than
    `du` on the same tree. None of these files are sparse, so the difference is
    filesystem slack rather than anything meaningful. Symlinks are not followed, which
    keeps a link into another tier from being counted twice. Unreadable entries are
    skipped rather than raised on: a partially-permissioned data directory should still
    produce a usable total.
    """
    if not path.exists():
        return 0
    total = 0
    for entry in path.rglob("*"):
        try:
            if entry.is_file() and not entry.is_symlink():
                total += entry.stat().st_size
        except OSError:
            continue
    return total


def _tiers(settings: Settings) -> list[Tier]:
    """The four filesystem tiers, in pipeline order.

    `reports_dir` is deliberately absent: it is human-facing output that lives beside
    the data rather than a storage tier, and since 2026-09-01 it does not necessarily
    sit under `data_dir` at all.
    """
    candidates = [
        ("raw", settings.raw_dir),
        ("parquet", settings.parquet_dir),
        ("duckdb", settings.duckdb_path.parent),
        ("packets", settings.packets_dir),
    ]
    return [
        Tier(name=name, path=path, bytes=directory_bytes(path), exists=path.exists())
        for name, path in candidates
    ]


_TABLE_SIZES = text("""
    SELECT c.relname AS name,
           pg_total_relation_size(c.oid) AS bytes,
           c.reltuples AS rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
""")

# Exact, and grouped by the column the geography spine already carries. The LEFT JOIN
# keeps a state with regions but no observations visible as a zero rather than dropping
# it, which is the shape a half-loaded expansion state will have.
_STATE_ROWS = text("""
    SELECT r.state_code AS state_code,
           count(DISTINCT r.region_id) AS regions,
           count(f.region_id) AS observations
    FROM regions r
    LEFT JOIN fact_metric_observation f ON f.region_id = r.region_id
    GROUP BY r.state_code
    ORDER BY r.state_code
""")


def measure(settings: Settings) -> Footprint:
    """Filesystem tiers always; database detail when Postgres answers."""
    tiers = _tiers(settings)

    try:
        with get_engine().connect() as conn:
            database_bytes = conn.execute(
                text("SELECT pg_database_size(current_database())")
            ).scalar_one()
            tables = [
                Table(
                    name=row.name,
                    bytes=int(row.bytes),
                    # reltuples is -1 on a never-analyzed table and a float otherwise.
                    rows=None if row.rows is None or row.rows < 0 else int(row.rows),
                )
                for row in conn.execute(_TABLE_SIZES)
            ]
            states = [
                StateRows(
                    state_code=row.state_code,
                    regions=int(row.regions),
                    observations=int(row.observations),
                )
                for row in conn.execute(_STATE_ROWS)
            ]
    except SQLAlchemyError as exc:
        # Unreachable, unmigrated, or mid-migration all land here. The filesystem answer
        # is still correct and is most of what a capacity question needs.
        return Footprint(tiers=tiers, database_error=type(exc).__name__)

    return Footprint(
        tiers=tiers,
        database_bytes=int(database_bytes),
        tables=tables,
        states=states,
    )


def human_bytes(value: int) -> str:
    """Bytes as a short decimal string — MB and GB as publishers quote them.

    Decimal rather than binary units to match `hip acquire`, which already reports
    downloads in MB at 1e6, and the README's resource table, which sitrep writes the
    same way. Two tools disagreeing about what MB means in the same document would be
    worse than either convention.
    """
    if value < 1_000:
        return f"{value} B"
    for unit, scale in (("GB", 1e9), ("MB", 1e6), ("kB", 1e3)):
        if value >= scale:
            return f"{value / scale:.1f} {unit}"
    return f"{value} B"


def as_dict(footprint: Footprint) -> dict[str, object]:
    """JSON-shaped view, so a measurement can be captured into a document."""
    return {
        "tiers": [
            {"name": t.name, "path": str(t.path), "bytes": t.bytes, "exists": t.exists}
            for t in footprint.tiers
        ],
        "filesystem_bytes": footprint.filesystem_bytes,
        "database_bytes": footprint.database_bytes,
        "database_error": footprint.database_error,
        "total_bytes": footprint.total_bytes,
        "tables": [
            {"name": t.name, "bytes": t.bytes, "rows_estimate": t.rows}
            for t in footprint.tables
        ],
        "states": [
            {
                "state_code": s.state_code,
                "regions": s.regions,
                "observations": s.observations,
            }
            for s in footprint.states
        ],
    }
