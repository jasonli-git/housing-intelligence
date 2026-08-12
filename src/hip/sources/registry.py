"""Which sources have adapters, and how to build them.

`config/sources.yml` lists every source the platform intends to use; this module lists
the ones that can actually be fetched today. The two diverge on purpose — the registry
tells a caller "not yet, that ships in Milestone N" instead of failing on an import.
"""

from __future__ import annotations

from hip.config import GeographyScope
from hip.sources.base import SourceAdapter
from hip.sources.bls import BlsAdapter
from hip.sources.census_acs import AcsAdapter
from hip.sources.census_permits import PermitsAdapter
from hip.sources.fhfa import HpiAdapter
from hip.sources.fred import FredAdapter
from hip.sources.irs_migration import MigrationAdapter
from hip.sources.tiger import TigerAdapter
from hip.sources.zillow import ZhviAdapter, ZoriAdapter

# source_id -> the milestone that delivers its adapter. Sources absent from this map
# and absent from the builders below are simply unknown.
# The most recent full year of BLS data. Passed to the adapter explicitly so a run is
# reproducible; bump it when a new year completes.
BLS_END_YEAR = 2025

PLANNED: dict[str, int] = {
    "nj_modiv": 7,
    "njgin_parcels": 7,
}

IMPLEMENTED: tuple[str, ...] = (
    TigerAdapter.source_id,
    ZhviAdapter.source_id,
    ZoriAdapter.source_id,
    HpiAdapter.source_id,
    PermitsAdapter.source_id,
    MigrationAdapter.source_id,
    AcsAdapter.source_id,
    FredAdapter.source_id,
    BlsAdapter.source_id,
)

# Sources carrying housing metrics, as opposed to geometry. `hip stage` and the fact
# loader iterate this; TIGER is deliberately absent because it produces regions.
METRIC_SOURCES: tuple[str, ...] = (
    ZhviAdapter.source_id,
    ZoriAdapter.source_id,
    HpiAdapter.source_id,
    PermitsAdapter.source_id,
    MigrationAdapter.source_id,
    AcsAdapter.source_id,
    FredAdapter.source_id,
    BlsAdapter.source_id,
)


# NJ county FIPS, needed to build BLS series ids. Derived from the state scope rather
# than hard-coded; counties are 001..041 odd-numbered in New Jersey.
def _county_fips(scope: GeographyScope) -> list[str]:
    from hip.config import fips_for

    return [
        f"{fips_for(state)}{n:03d}" for state in scope.states for n in range(1, 42, 2)
    ]


class UnknownSourceError(Exception):
    """Named source has no adapter. Message says whether it is planned or unknown."""


def build_adapter(source_id: str, scope: GeographyScope) -> SourceAdapter:
    if source_id == TigerAdapter.source_id:
        return TigerAdapter(states=scope.states)
    if source_id == ZhviAdapter.source_id:
        return ZhviAdapter()
    if source_id == ZoriAdapter.source_id:
        return ZoriAdapter()
    if source_id == HpiAdapter.source_id:
        return HpiAdapter()
    if source_id == PermitsAdapter.source_id:
        return PermitsAdapter()
    if source_id == MigrationAdapter.source_id:
        return MigrationAdapter()
    if source_id == AcsAdapter.source_id:
        return AcsAdapter(states=scope.states)
    if source_id == FredAdapter.source_id:
        return FredAdapter()
    if source_id == BlsAdapter.source_id:
        return BlsAdapter(county_fips=_county_fips(scope), end_year=BLS_END_YEAR)
    if (milestone := PLANNED.get(source_id)) is not None:
        raise UnknownSourceError(
            f"'{source_id}' has no adapter yet — it ships in Milestone {milestone}. "
            f"See ROADMAP.md."
        )
    raise UnknownSourceError(
        f"'{source_id}' is not a known source. Implemented: {', '.join(IMPLEMENTED)}"
    )
