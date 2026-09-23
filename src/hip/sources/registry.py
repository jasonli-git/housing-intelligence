"""Which sources have adapters, and how to build them.

`config/sources.yml` lists every source the platform intends to use; this module lists
the ones that can actually be fetched today. The two diverge on purpose — the registry
tells a caller "not yet, that ships in Milestone N" instead of failing on an import.
"""

from __future__ import annotations

from pathlib import Path

from hip.config import GeographyScope
from hip.sources.base import SourceAdapter, read_discovery
from hip.sources.bls import BlsAdapter
from hip.sources.census_acs import AcsAdapter
from hip.sources.census_pep import PepAdapter
from hip.sources.census_permits import PermitsAdapter
from hip.sources.fhfa import HpiAdapter
from hip.sources.fred import FredAdapter
from hip.sources.hud import HudAdapter, HudChasAdapter, HudFmrAdapter
from hip.sources.irs_migration import MigrationAdapter
from hip.sources.nj_modiv import ModivAdapter
from hip.sources.nj_sr1a import Sr1aAdapter
from hip.sources.nj_tax_rates import NjTaxRatesAdapter
from hip.sources.tiger import TigerAdapter
from hip.sources.zillow import ZhviAdapter, ZoriAdapter

# source_id -> the milestone that delivers its adapter. Sources absent from this map
# and absent from the builders below are simply unknown.
# Floors: the newest year each of these sources was known to have when it was written.
# Since Milestone 26 they are no longer bumped by hand. Acquisition *discovers* the
# newest release (`SourceAdapter.discover`) and records it beside the cache; these are
# what an adapter answers with before discovery has ever run, and discovery never moves
# below them. They were the reason BLS stopped at 2025 while BLS held data through July
# 2026 — a constant nobody had bumped.
BLS_END_YEAR = 2025

# The ACS adapter takes the four vintages before its newest too. Hard-coded inside the
# adapter from Milestone 3 until Milestone 24 moved the control here.
ACS_END_YEAR = 2024

# NJ's rate and ratio workbooks. The year also names the worksheet —
# `General Tax Rates 1997-2025` — so a stale value fails loudly on read.
NJ_TAX_END_YEAR = 2025

# `njgin_parcels` stays planned: the MOD-IV composite layer already carries parcel
# geometry alongside the assessment attributes, so a separate geometry source would
# fetch the same shapes twice. It is kept here because a parcel map layer (post-V1)
# needs geometry this adapter deliberately does not download.
PLANNED: dict[str, int] = {
    "njgin_parcels": 8,
}

IMPLEMENTED: tuple[str, ...] = (
    TigerAdapter.source_id,
    ZhviAdapter.source_id,
    ZoriAdapter.source_id,
    HpiAdapter.source_id,
    PermitsAdapter.source_id,
    MigrationAdapter.source_id,
    AcsAdapter.source_id,
    PepAdapter.source_id,
    FredAdapter.source_id,
    BlsAdapter.source_id,
    HudAdapter.source_id,
    HudFmrAdapter.source_id,
    HudChasAdapter.source_id,
    ModivAdapter.source_id,
    Sr1aAdapter.source_id,
    NjTaxRatesAdapter.source_id,
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
    PepAdapter.source_id,
    FredAdapter.source_id,
    BlsAdapter.source_id,
    HudAdapter.source_id,
    HudFmrAdapter.source_id,
    HudChasAdapter.source_id,
    ModivAdapter.source_id,
    Sr1aAdapter.source_id,
    NjTaxRatesAdapter.source_id,
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


def build_adapter(
    source_id: str, scope: GeographyScope, *, raw_dir: Path | None = None
) -> SourceAdapter:
    """An adapter for `source_id`, answering with its recorded newest release.

    `raw_dir` is where acquisition records what it discovered. Every stage passes it, so
    the stages after acquisition build their refs from the same newest release
    acquisition fetched — offline, and without asking the publisher again (#197). A
    caller that omits it gets the adapter's floor, which is what tests want.
    """
    adapter = _construct(source_id, scope)
    if raw_dir is not None and (recorded := read_discovery(raw_dir, source_id)):
        adapter.newest = recorded.newest
    return adapter


def _construct(source_id: str, scope: GeographyScope) -> SourceAdapter:
    if source_id == TigerAdapter.source_id:
        return TigerAdapter(states=scope.states)
    if source_id == ZhviAdapter.source_id:
        return ZhviAdapter()
    if source_id == ZoriAdapter.source_id:
        return ZoriAdapter()
    if source_id == HpiAdapter.source_id:
        return HpiAdapter()
    if source_id == PermitsAdapter.source_id:
        return PermitsAdapter(states=scope.states)
    if source_id == MigrationAdapter.source_id:
        return MigrationAdapter()
    if source_id == AcsAdapter.source_id:
        return AcsAdapter(states=scope.states, end_year=ACS_END_YEAR)
    if source_id == PepAdapter.source_id:
        return PepAdapter(states=scope.states)
    if source_id == FredAdapter.source_id:
        return FredAdapter()
    if source_id == BlsAdapter.source_id:
        return BlsAdapter(county_fips=_county_fips(scope), end_year=BLS_END_YEAR)
    if source_id == HudAdapter.source_id:
        return HudAdapter(states=scope.states, county_fips=_county_fips(scope))
    if source_id == HudFmrAdapter.source_id:
        return HudFmrAdapter(states=scope.states)
    if source_id == HudChasAdapter.source_id:
        return HudChasAdapter(states=scope.states, county_fips=_county_fips(scope))
    if source_id == ModivAdapter.source_id:
        return ModivAdapter()
    if source_id == Sr1aAdapter.source_id:
        return Sr1aAdapter()
    if source_id == NjTaxRatesAdapter.source_id:
        return NjTaxRatesAdapter(end_year=NJ_TAX_END_YEAR)
    if (milestone := PLANNED.get(source_id)) is not None:
        raise UnknownSourceError(
            f"'{source_id}' has no adapter yet — it ships in Milestone {milestone}. "
            f"See ROADMAP.md."
        )
    raise UnknownSourceError(
        f"'{source_id}' is not a known source. Implemented: {', '.join(IMPLEMENTED)}"
    )
