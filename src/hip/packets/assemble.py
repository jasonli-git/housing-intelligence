"""Assemble an analysis packet for one region from the warehouse.

Reads only. Every number comes out of `fact_metric_change`, `region_rankings`, or
`fact_metric_observation` — nothing is calculated here, which is what makes a packet
reproducible from the warehouse alone (ARCHITECTURE #12).

The queries take a `Session` rather than an engine so the API can assemble inside the
request's read-only session and the CLI can open its own. There is no cache and no file
read: a packet is cheap enough to build on demand, and a stale artifact served as
current would undermine the provenance the packet exists to carry.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.packets.caveats import caveats_for
from hip.packets.schema import (
    PACKET_VERSION,
    Packet,
    PacketComparisons,
    PacketHighlight,
    PacketLevel,
    PacketMetric,
    PacketRegion,
    PacketSource,
    PacketWindow,
    RegionRef,
)

# A region is "at one end" of its cohort within this many places of either extreme.
# Selection only — the rank itself is read from region_rankings.
HIGHLIGHT_DEPTH = 3

# Below this many peers, being third from the top is not a distinction worth reporting.
MIN_COHORT = 5

_REGION_SQL = text(
    """
    SELECT r.region_id, r.geoid, r.level::text AS level, r.name, r.state_code,
           p.region_id AS parent_id, p.name AS parent_name,
           p.level::text AS parent_level
    FROM regions r
    LEFT JOIN regions p ON p.region_id = r.parent_id
    WHERE r.region_id = :id
    """
)

# DISTINCT ON guards the provenance join: `window_end` is a period_end, and while the
# fact table is keyed on period_start, nothing stops two observations sharing an end
# date. Without it a single metric could appear twice in a packet.
_METRICS_SQL = text(
    """
    SELECT DISTINCT ON (c.metric_id)
           c.metric_id, m.label, m.unit, m.direction,
           c.window_start, c.window_end, c.start_value, c.end_value,
           c.pct_change, c.cagr,
           k.rank, k.of, k.percentile,
           o.release_id, sr.source_id, o.match_method
    FROM fact_metric_change c
    JOIN metrics m ON m.metric_id = c.metric_id
    LEFT JOIN region_rankings k
      ON k.region_id = c.region_id AND k.metric_id = c.metric_id
     AND k."window" = c."window"
    LEFT JOIN fact_metric_observation o
      ON o.region_id = c.region_id AND o.metric_id = c.metric_id
     AND o.period_end = c.window_end
    LEFT JOIN source_releases sr ON sr.release_id = o.release_id
    WHERE c.region_id = :id AND c."window" = :w
    ORDER BY c.metric_id, o.period_start DESC
    """
)

# The latest observation of every metric this region has, with its value rank. This is
# the only route into a packet for a single-vintage source: `fact_metric_change` needs
# two observations, and MOD-IV publishes one composite.
_LEVELS_SQL = text(
    """
    SELECT DISTINCT ON (f.metric_id)
           f.metric_id, m.label, m.unit, m.direction, f.value,
           f.period_start, f.period_end,
           k.rank, k.of, k.percentile,
           f.release_id, sr.source_id, f.match_method
    FROM fact_metric_observation f
    JOIN metrics m ON m.metric_id = f.metric_id
    JOIN source_releases sr ON sr.release_id = f.release_id
    LEFT JOIN region_rankings k
      ON k.region_id = f.region_id AND k.metric_id = f.metric_id AND k.basis = 'value'
    WHERE f.region_id = :id
    ORDER BY f.metric_id, f.period_end DESC
    """
)

_PEERS_SQL = text(
    """
    SELECT count(*) FROM regions
    WHERE level = CAST(:level AS region_level) AND state_code = :state
    """
)

_CROSSWALK_SQL = text(
    "SELECT DISTINCT method FROM region_crosswalk WHERE from_region_id = :id ORDER BY 1"
)

_SOURCES_SQL = text(
    """
    SELECT sr.release_id, sr.source_id, sr.vintage, sr.fetched_at,
           s.name, s.publisher, s.license, s.url
    FROM source_releases sr
    JOIN sources s ON s.source_id = sr.source_id
    WHERE sr.release_id = ANY(:ids)
    ORDER BY sr.source_id, sr.vintage, sr.release_id
    """
)

# Sources whose provenance in *this region* is actually collapsed: several periods
# observed, one release cited, and more than one vintage available to have cited.
#
# Milestone 6 approximated this as "the source has several vintages", which was true of
# every multi-vintage source while the loader keyed releases on `(source, layer)` alone
# (ARCHITECTURE #47). Milestone 7 fixed the loader (#53), so the approximation would now
# report a defect that no longer exists. This asks the fact table directly, which means
# the caveat disappears exactly when the data stops warranting it.
#
# `hip_derived` is excluded and is not a false negative: its releases are one per
# `hip analyze` run rather than one per upstream file, and the derived facts genuinely
# carry the release of the run that computed them (#34).
_MULTI_VINTAGE_SQL = text(
    """
    SELECT sr.source_id
    FROM fact_metric_observation f
    JOIN source_releases sr ON sr.release_id = f.release_id
    WHERE f.region_id = :id AND sr.source_id <> 'hip_derived'
    GROUP BY sr.source_id
    HAVING count(DISTINCT f.period_end) > 1
       AND count(DISTINCT f.release_id) = 1
       AND (
           SELECT count(DISTINCT s2.vintage) FROM source_releases s2
           WHERE s2.source_id = sr.source_id
       ) > 1
    ORDER BY sr.source_id
    """
)


class PacketUnavailable(LookupError):
    """No packet can be built — unknown region, or no analytics for that window."""


def display_label(name: str, level: str, state_code: str) -> str:
    """'Mercer' at county level in NJ becomes 'Mercer County, NJ'.

    The packet carries the label so every consumer — report, dashboard, any future
    model — names a place the same way instead of each inventing its own rule.
    """
    if level == "nation" or level == "state":
        return name
    if level == "county" and not name.lower().endswith("county"):
        name = f"{name} County"
    elif level == "zip":
        name = f"ZIP {name}"
    elif level == "tract":
        name = f"Tract {name}"
    return f"{name}, {state_code}"


def build_packet(session: Session, region_id: int, window: str = "5y") -> Packet:
    """One region's packet for one change window.

    Raises `PacketUnavailable` when the region does not exist, or when it has neither
    change rows nor observations — an empty packet would validate against the schema
    while telling a reader nothing, which is worse than an error. Having only one of
    the two is not empty: a snapshot-only region has levels and no changes.
    """
    region = session.execute(_REGION_SQL, {"id": region_id}).mappings().one_or_none()
    if region is None:
        raise PacketUnavailable(f"No region {region_id}")

    rows = list(session.execute(_METRICS_SQL, {"id": region_id, "w": window}).mappings())
    metrics = [PacketMetric(**row) for row in rows]
    levels = [
        PacketLevel(**row)
        for row in session.execute(_LEVELS_SQL, {"id": region_id}).mappings()
    ]
    # A region with observations but no change rows is a real case, not an error: it is
    # what a place covered only by a single-vintage source looks like. Refusing it here
    # would make MOD-IV-only municipalities unpackagable.
    if not metrics and not levels:
        raise PacketUnavailable(
            f"No analytics for region {region_id} at window {window} — run `hip analyze`"
        )

    peer_count = int(
        session.execute(
            _PEERS_SQL, {"level": region["level"], "state": region["state_code"]}
        ).scalar_one()
    )

    crosswalk_methods = (
        [r[0] for r in session.execute(_CROSSWALK_SQL, {"id": region_id})]
        if region["level"] == "zip"
        else []
    )

    sources = _sources(session, [*metrics, *levels])
    multi_vintage = [
        str(row[0]) for row in session.execute(_MULTI_VINTAGE_SQL, {"id": region_id})
    ]

    packet = Packet(
        packet_version=PACKET_VERSION,  # type: ignore[arg-type]
        region=PacketRegion(
            region_id=region["region_id"],
            geoid=region["geoid"],
            level=region["level"],
            name=region["name"],
            label=display_label(region["name"], region["level"], region["state_code"]),
            state_code=region["state_code"],
            parent=(
                RegionRef(
                    region_id=region["parent_id"],
                    name=region["parent_name"],
                    level=region["parent_level"],
                )
                if region["parent_id"] is not None
                else None
            ),
        ),
        # With no change rows the envelope falls back to the observation periods, so a
        # snapshot-only region still reports the span its figures describe.
        window=PacketWindow(
            label=window,
            start=min(m.window_start for m in metrics)
            if metrics
            else min(lv.period_start for lv in levels),
            end=max(m.window_end for m in metrics)
            if metrics
            else max(lv.period_end for lv in levels),
        ),
        metrics=metrics,
        levels=levels,
        comparisons=PacketComparisons(
            peer_level=region["level"],
            peer_scope=region["state_code"],
            peer_count=peer_count,
        ),
        highlights=_highlights(metrics),
        caveats=caveats_for(
            level=region["level"],
            metric_ids=[m.metric_id for m in metrics] + [lv.metric_id for lv in levels],
            match_methods=[
                *(m.match_method for m in metrics if m.match_method),
                *(lv.match_method for lv in levels if lv.match_method),
            ],
            crosswalk_methods=crosswalk_methods,
            thin_cohort=any(m.of is not None and m.of < peer_count for m in metrics),
            multi_vintage_sources=multi_vintage,
        ),
        sources=sources,
    )
    return packet


def _highlights(metrics: list[PacketMetric]) -> list[PacketHighlight]:
    """Metrics where this region sits at one end of its cohort.

    Leading first, best rank first; then trailing, worst rank first. `direction` has
    already been applied by `hip analyze`, so rank 1 is the good end whatever the
    metric measures.
    """
    leading: list[PacketHighlight] = []
    trailing: list[PacketHighlight] = []
    for metric in metrics:
        if metric.rank is None or metric.of is None or metric.of < MIN_COHORT:
            continue
        if metric.rank <= HIGHLIGHT_DEPTH:
            bucket, position = leading, "leading"
        elif metric.rank > metric.of - HIGHLIGHT_DEPTH:
            bucket, position = trailing, "trailing"
        else:
            continue
        bucket.append(
            PacketHighlight(
                metric_id=metric.metric_id,
                label=metric.label,
                position=position,  # type: ignore[arg-type]
                rank=metric.rank,
                of=metric.of,
                pct_change=metric.pct_change,
            )
        )
    leading.sort(key=lambda h: (h.rank, h.metric_id))
    trailing.sort(key=lambda h: (-h.rank, h.metric_id))
    return leading + trailing


def _sources(
    session: Session, entries: Sequence[PacketMetric | PacketLevel]
) -> list[PacketSource]:
    """The releases behind the packet's values, one entry per source and vintage.

    Takes both arrays: a source reaching the packet only through `levels` — which is
    every snapshot source — still has to appear in the source table.
    """
    release_ids = sorted({e.release_id for e in entries if e.release_id is not None})
    if not release_ids:
        return []

    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    order: list[tuple[str, str]] = []
    for row in session.execute(_SOURCES_SQL, {"ids": release_ids}).mappings():
        key = (row["source_id"], row["vintage"])
        entry = grouped.get(key)
        if entry is None:
            order.append(key)
            grouped[key] = {
                "source_id": row["source_id"],
                "name": row["name"],
                "publisher": row["publisher"],
                "license": row["license"],
                "url": row["url"],
                "vintage": row["vintage"],
                # Several releases of one vintage differ only by layer; the earliest
                # fetch is when this vintage entered the warehouse.
                "fetched_at": row["fetched_at"],
                "release_ids": [],
            }
            entry = grouped[key]
        entry["fetched_at"] = min(entry["fetched_at"], row["fetched_at"])
        ids: list[int] = entry["release_ids"]
        ids.append(row["release_id"])

    return [PacketSource(**grouped[key]) for key in order]


def regions_for_level(session: Session, level: str, window: str) -> list[int]:
    """Regions of one level that have analytics for a window, in a stable order."""
    rows = session.execute(
        text(
            """
            SELECT DISTINCT r.region_id
            FROM fact_metric_change c
            JOIN regions r ON r.region_id = c.region_id
            WHERE r.level = CAST(:level AS region_level) AND c."window" = :w
            ORDER BY r.region_id
            """
        ),
        {"level": level, "w": window},
    )
    return [int(row[0]) for row in rows]


__all__ = [
    "PacketUnavailable",
    "build_packet",
    "display_label",
    "regions_for_level",
]
