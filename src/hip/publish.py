"""Render the enumerable API surface to a tree of static files.

The platform has no request-time compute: the warehouse changes when the pipeline runs,
every endpoint is a pure function of it, and nothing is personalised. So the API does not
need to be *running* in production — it needs to have *run once*, with its answers saved.
This module is that run.

**Artifacts are produced by replaying the API's own ASGI app** (#67), not by re-querying
the warehouse. Response models, serialisation, float formatting, and null handling are
then the same code that serves `make api`, so a published file cannot drift from the
endpoint it claims to mirror. Re-implementing the queries here would have been a second
definition of every response, and the first one to change would break the promise
silently. This is the only module in `src/hip` permitted to import `hip.api`, and
`tests/test_module_boundaries.py` fails if a second one appears.

**Windows are path segments, not query strings.** A static file cannot vary on
`?window=5y`, so `/regions/11/summary` is published as `regions/11/summary/5y.json`.
Chosen over implying the window in the filename because publishing a second window later
then adds files rather than moving every URL that already exists.

**Not everything can be published, and the gap is deliberate.** `/compare` takes an
arbitrary set of region ids and `/regions?q=` is free-text search; neither enumerates, so
neither is here. `hip.publish` says so in the manifest rather than silently omitting
them. The seam where they would come back is a queryable data layer in the browser —
DuckDB-WASM over published Parquet — which is a different milestone and a different shape
of answer.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

from hip.api.main import app
from hip.warehouse.db import get_engine

# The window this milestone publishes. A tuple rather than a constant because the path
# layout was designed for several; adding "10y" here is the whole change.
PUBLISHED_WINDOWS: tuple[str, ...] = ("5y",)

# Endpoints whose parameter space does not enumerate. Recorded in the manifest so a
# consumer of the static tree learns what is missing from the tree itself.
UNPUBLISHABLE: dict[str, str] = {
    "/compare": "takes an arbitrary set of region_ids; combinatorial",
    "/regions?q=": "free-text search over region names",
    "/regions/{id}/metrics?from=&to=": (
        "arbitrary date ranges; the unfiltered full series is published instead"
    ),
}


@dataclass(frozen=True)
class Artifact:
    """One published file and the API path it mirrors."""

    path: str
    source: str
    bytes: int
    sha256: str


@dataclass
class Result:
    """What a publish run produced."""

    root: Path
    artifacts: list[Artifact] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    region_geoids: dict[str, str] = field(default_factory=dict)

    @property
    def total_bytes(self) -> int:
        return sum(a.bytes for a in self.artifacts)


class RegionIdentityChanged(RuntimeError):
    """A region_id now names a different place than the last publish recorded.

    Published URLs key on `region_id`, which is a surrogate key rather than a GEOID
    (Bergen is region 8 and GEOID 34003; the two are unrelated). `warehouse.load`
    upserts on `(level, geoid)` and never reassigns, so ids survive a reload and survive
    new states being added. They do *not* survive a database rebuilt from empty — which
    is precisely what pointing `HIP_PGDATA` at a fresh directory does.

    Left undetected that is the worst kind of failure: every URL still resolves, still
    returns valid JSON, and quietly describes a different county. Bookmarks and inbound
    links rot into wrong answers rather than 404s.
    """


def _region_geoids(engine_conn) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """region_id -> geoid for every region with data, as the manifest records it."""
    return {
        str(row.region_id): row.geoid
        for row in engine_conn.execute(
            text("""
                SELECT DISTINCT r.region_id, r.geoid
                FROM regions r
                JOIN fact_metric_observation f ON f.region_id = r.region_id
                ORDER BY r.region_id
            """)
        )
    }


def _check_region_identity(root: Path, current: dict[str, str]) -> None:
    """Refuse to overwrite a tree whose ids meant something else.

    Compared against the previous manifest in the same directory, so the check costs
    nothing and needs no state of its own. A first publish has nothing to compare and
    passes.
    """
    previous_path = root / "manifest.json"
    if not previous_path.exists():
        return
    try:
        previous = json.loads(previous_path.read_text()).get("regions", {})
    except (OSError, json.JSONDecodeError):
        return  # An unreadable manifest is not evidence of a change.

    moved = {
        region_id: (was, current[region_id])
        for region_id, was in previous.items()
        if region_id in current and current[region_id] != was
    }
    if moved:
        detail = ", ".join(
            f"region {rid}: {was} -> {now}" for rid, (was, now) in sorted(moved.items())
        )
        raise RegionIdentityChanged(
            f"{len(moved)} region id(s) now name a different geography than the last "
            f"publish: {detail}. Every published URL for them would silently change "
            f"meaning. This happens when the warehouse is rebuilt from empty rather "
            f"than reloaded. Publish to a clean directory and re-deploy the whole tree, "
            f"or restore the previous database."
        )


def _regions_with_data(engine_conn) -> list[int]:  # type: ignore[no-untyped-def]
    """Region ids carrying at least one observation, in id order.

    The spine holds 3,366 regions but only 1,135 have any observation — every one of the
    2,181 tracts is empty, because no source in the warehouse publishes at tract level.
    Publishing a page per region regardless would put 2,181 blank pages on a public site
    and inflate the file count past the host's per-deployment limit for nothing.
    """
    return [
        row[0]
        for row in engine_conn.execute(
            text("""
                SELECT DISTINCT region_id
                FROM fact_metric_observation
                ORDER BY region_id
            """)
        )
    ]


def _ranking_keys(engine_conn) -> list[tuple[str, str, str, str]]:  # type: ignore[no-untyped-def]
    """Every (metric, level, window, basis) that actually has rows.

    Enumerated from the data rather than from the product of the vocabularies: 23 metrics
    × 6 levels × 6 windows × 2 bases is 1,656 combinations, of which 141 exist. Rendering
    the product would mean 1,515 files that are all the same empty list.
    """
    return [
        (row.metric_id, row.level, row.window, row.basis)
        for row in engine_conn.execute(
            text("""
                SELECT DISTINCT metric_id, level::text AS level, "window", basis
                FROM region_rankings
                ORDER BY metric_id, level, "window", basis
            """)
        )
    ]


def _plan(
    region_ids: list[int], keys: list[tuple[str, str, str, str]]
) -> Iterator[tuple[str, str]]:
    """Yield (api_path, output_path) pairs. Pure, so the layout is testable alone."""
    yield "/health", "health.json"
    yield "/metrics", "metrics.json"
    yield "/sources/unresolved", "sources/unresolved.json"

    for level in ("state", "county", "municipality", "zip"):
        yield f"/geo/{level}?state=NJ", f"geo/{level}.json"

    for region_id in region_ids:
        yield f"/regions/{region_id}", f"regions/{region_id}.json"
        # The unfiltered series for every metric the region has. The filtered form takes
        # arbitrary dates and is listed in UNPUBLISHABLE instead.
        yield f"/regions/{region_id}/metrics", f"regions/{region_id}/metrics.json"
        for window in PUBLISHED_WINDOWS:
            base = f"/regions/{region_id}"
            out = f"regions/{region_id}"
            yield f"{base}/summary?window={window}", f"{out}/summary/{window}.json"
            yield f"{base}/packet?window={window}", f"{out}/packet/{window}.json"
            # Markdown, not JSON: `/regions/{id}/report` serves text/markdown.
            yield f"{base}/report?window={window}", f"{out}/report/{window}.md"
            explain = f"{out}/explanation/{window}.json"
            yield f"{base}/explanation?window={window}", explain

    for metric_id, level, window, basis in keys:
        # `window` here comes out of `region_rankings`, where a value ranking is stored
        # under the sentinel "latest". That is storage vocabulary, not API vocabulary:
        # the endpoint's `Window` literal has no "latest", and `basis=value` ignores the
        # parameter entirely because a level has no span. So the request omits the
        # window for value rankings, while the output path keeps it — the path mirrors
        # how the data is keyed, and dropping it would collide every value ranking for a
        # metric into one file per level.
        query = f"/rankings?metric_id={metric_id}&level={level}&basis={basis}&limit=1000"
        if basis != "value":
            query += f"&window={window}"
        yield query, f"rankings/{metric_id}/{level}/{window}/{basis}.json"


def publish(root: Path) -> Result:
    """Render every enumerable endpoint under ``root``.

    A 404 is a skip, not a failure. Most regions have no explanation — only the 21
    counties `hip explain` was run for do — and asking for one is the cheapest way to
    find out. Any other non-200 raises, because it means an endpoint that should have
    answered did not, and publishing a tree with a silent hole in it is worse than
    failing the run.
    """
    with get_engine().connect() as conn:
        region_ids = _regions_with_data(conn)
        keys = _ranking_keys(conn)
        geoids = _region_geoids(conn)

    _check_region_identity(root, geoids)

    result = Result(root=root, region_geoids=geoids)
    with TestClient(app) as client:
        for api_path, out_path in _plan(region_ids, keys):
            response = client.get(api_path)
            if response.status_code == 404:
                result.skipped.append(api_path)
                continue
            if response.status_code != 200:
                raise RuntimeError(
                    f"{api_path} returned {response.status_code}; refusing to publish "
                    f"a tree with a hole in it"
                )
            payload = response.content
            destination = root / out_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
            result.artifacts.append(
                Artifact(
                    path=out_path,
                    source=api_path,
                    bytes=len(payload),
                    sha256=hashlib.sha256(payload).hexdigest(),
                )
            )

    _write_manifest(result)
    return result


def _write_manifest(result: Result) -> None:
    """Record what was published, with hashes, and what deliberately was not.

    Hashes are for verification and drift detection, not for cache-busting: the artifact
    URLs stay clean, because the point of the tree is that `/regions/11/packet/5y.json`
    is reachable at the path its endpoint implies. A content-addressed URL would defeat
    that.
    """
    manifest = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "windows": list(PUBLISHED_WINDOWS),
        "artifact_count": len(result.artifacts),
        "total_bytes": result.total_bytes,
        "unpublishable": UNPUBLISHABLE,
        # region_id -> geoid. Published URLs key on the surrogate id, so this is what
        # lets the next publish prove the ids still mean the same places.
        "regions": result.region_geoids,
        "skipped_404": sorted(result.skipped),
        "artifacts": [
            {"path": a.path, "source": a.source, "bytes": a.bytes, "sha256": a.sha256}
            for a in result.artifacts
        ],
    }
    (result.root / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
