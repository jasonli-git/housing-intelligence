"""Every state's outline, loaded as map context rather than as regions.

Milestone 16 puts New Jersey on a navigable map of the whole country, which means the
other 49 states have to be drawn. They are not regions and must not become them: a
region here carries observations, a parent chain, identifiers other sources key on, and
a place in the denominators the site quotes. These carry a shape and nothing else, so
they load into `map_backdrop`, which joins to nothing (migration 0012).

Nothing is downloaded. TIGER publishes its `state` layer nationally, so `hip acquire`
fetched all 56 states and territories to reach New Jersey's one, and `hip land`
transcoded them to Parquet. This reads that file.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import duckdb
from sqlalchemy import Engine, text

# The 50 states, DC and Puerto Rico — what Milestone 15 names as national coverage, so
# the backdrop shows exactly the ground the platform could one day hold. The remaining
# TIGER rows are the Pacific and Caribbean territories, thousands of miles from any of
# it and outside every published plan.
EXCLUDED_CODES = ("AS", "GU", "MP", "VI")

# Douglas-Peucker tolerance in degrees, about 2km. The backdrop is drawn at continental
# zoom, where that is finer than a screen pixel: at 0.005 the same 52 outlines cost
# 449KB to draw what 145KB already draws (measured 2026-09-17).
# ST_SimplifyPreserveTopology rather than ST_Simplify, for the reason `/geo/{level}`
# gives — the latter can produce self-intersecting rings.
SIMPLIFY_DEG = 0.02

_INSERT = text(
    """
    INSERT INTO map_backdrop (level, code, name, geom)
    VALUES (:level, :code, :name, ST_Multi(ST_GeomFromWKB(:geom, 4269)))
    ON CONFLICT (level, code) DO UPDATE SET
        name = EXCLUDED.name,
        geom = EXCLUDED.geom
    """
)


@dataclass(frozen=True)
class BackdropResult:
    """What was loaded, per level. The numbers a test asserts on."""

    by_level: dict[str, int]

    @property
    def total(self) -> int:
        return sum(self.by_level.values())


def state_outlines(
    con: duckdb.DuckDBPyConnection, *, parquet_dir: Path, vintage: str
) -> list[tuple[str, str, bytes]]:
    """(code, name, simplified WKB) for each state, from the landed TIGER Parquet."""
    source = parquet_dir / "census_tiger" / vintage / "state.parquet"
    if not source.exists():
        raise FileNotFoundError(
            f"{source} is missing — run `hip acquire --source census_tiger`, "
            f"then `hip land`"
        )
    placeholders = ", ".join("?" for _ in EXCLUDED_CODES)
    rows = con.execute(
        f"""
        SELECT STUSPS, NAME,
               ST_AsWKB(ST_SimplifyPreserveTopology(ST_GeomFromWKB(geom_wkb), ?)) AS geom
        FROM read_parquet(?)
        WHERE STUSPS NOT IN ({placeholders})
        ORDER BY STUSPS
        """,
        [SIMPLIFY_DEG, str(source), *EXCLUDED_CODES],
    ).fetchall()
    return [(str(r[0]), str(r[1]), bytes(r[2])) for r in rows]


def load_backdrop(
    engine: Engine,
    con: duckdb.DuckDBPyConnection,
    *,
    parquet_dir: Path,
    vintage: str,
) -> BackdropResult:
    """Replace the backdrop from the landed Parquet. Idempotent."""
    states = state_outlines(con, parquet_dir=parquet_dir, vintage=vintage)
    payload: list[dict[str, Any]] = [
        {"level": "state", "code": code, "name": name, "geom": geom}
        for code, name, geom in states
    ]
    with engine.begin() as conn:
        # Delete first: a state dropped from a later TIGER vintage would otherwise stay
        # on the map forever, since the upsert only ever adds and updates.
        conn.execute(text("DELETE FROM map_backdrop WHERE level = 'state'"))
        if payload:
            conn.execute(_INSERT, payload)
    return BackdropResult(by_level={"state": len(payload)})
