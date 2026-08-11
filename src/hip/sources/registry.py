"""Which sources have adapters, and how to build them.

`config/sources.yml` lists every source the platform intends to use; this module lists
the ones that can actually be fetched today. The two diverge on purpose — the registry
tells a caller "not yet, that ships in Milestone N" instead of failing on an import.
"""

from __future__ import annotations

from hip.config import GeographyScope
from hip.sources.base import SourceAdapter
from hip.sources.tiger import TigerAdapter
from hip.sources.zillow import ZhviAdapter, ZoriAdapter

# source_id -> the milestone that delivers its adapter. Sources absent from this map
# and absent from the builders below are simply unknown.
PLANNED: dict[str, int] = {
    "census_acs": 3,
    "census_permits": 3,
    "fhfa_hpi": 3,
    "fred": 3,
    "bls": 3,
    "irs_migration": 3,
    "nj_modiv": 7,
    "njgin_parcels": 7,
}

IMPLEMENTED: tuple[str, ...] = (
    TigerAdapter.source_id,
    ZhviAdapter.source_id,
    ZoriAdapter.source_id,
)

# Sources carrying housing metrics, as opposed to geometry. `hip stage` and the fact
# loader iterate this; TIGER is deliberately absent because it produces regions.
METRIC_SOURCES: tuple[str, ...] = (ZhviAdapter.source_id, ZoriAdapter.source_id)


class UnknownSourceError(Exception):
    """Named source has no adapter. Message says whether it is planned or unknown."""


def build_adapter(source_id: str, scope: GeographyScope) -> SourceAdapter:
    if source_id == TigerAdapter.source_id:
        return TigerAdapter(states=scope.states)
    if source_id == ZhviAdapter.source_id:
        return ZhviAdapter()
    if source_id == ZoriAdapter.source_id:
        return ZoriAdapter()
    if (milestone := PLANNED.get(source_id)) is not None:
        raise UnknownSourceError(
            f"'{source_id}' has no adapter yet — it ships in Milestone {milestone}. "
            f"See ROADMAP.md."
        )
    raise UnknownSourceError(
        f"'{source_id}' is not a known source. Implemented: {', '.join(IMPLEMENTED)}"
    )
