"""Zillow Research public CSVs — home values (ZHVI) and rents (ZORI).

Zillow publishes one wide CSV per (index, geography level): identifying columns, then
one column per month from 2000 onward. Each file covers the whole country, so a
single-state load still downloads national files — there is no state partition.

Two adapters rather than one because ZHVI and ZORI are separate products with different
file naming, different geography coverage, and different revision behavior. They share
everything else through `SourceAdapter`.

Series selection is deliberate and narrow: the headline ZHVI cut (mid-tier, smoothed,
seasonally adjusted) and all-homes ZORI. Zillow also publishes bottom/top tier and
SFR-only variants; adding one is a new `metric_id` and a row here, never a schema change.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://files.zillowstatic.com/research/public_csvs"

# Zillow's geography level -> the region level it resolves to in our warehouse.
# "City" is Zillow's own definition and does NOT correspond cleanly to Census county
# subdivisions; see hip.geography.matching for what that costs.
LEVEL_BY_LAYER = {
    "county": "county",
    "city": "municipality",
    "zip": "zip",
}


class _ZillowAdapter(SourceAdapter):
    """Shared shape: one file per geography level, national coverage, no API key."""

    product: ClassVar[str]
    file_stem: ClassVar[str]
    metric_id: ClassVar[str]

    # Zillow's file naming capitalizes the level; ours does not.
    LAYER_PREFIX: ClassVar[dict[str, str]] = {
        "county": "County",
        "city": "City",
        "zip": "Zip",
    }

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        # Zillow does not version its URLs — the same path always serves the current
        # release. The vintage is therefore ours to assign, and the content hash is what
        # actually distinguishes one release from another (ARCHITECTURE #10).
        vintage = vintage or self.default_vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=layer,
                vintage=vintage,
                url=f"{BASE_URL}/{self.product}/{prefix}_{self.file_stem}.csv",
            )
            for layer, prefix in self.LAYER_PREFIX.items()
        ]


class ZhviAdapter(_ZillowAdapter):
    """Zillow Home Value Index: the typical home value for the middle price tier."""

    source_id: ClassVar[str] = "zillow_zhvi"
    default_vintage: ClassVar[str] = "current"
    product: ClassVar[str] = "zhvi"
    file_stem: ClassVar[str] = "zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month"
    metric_id: ClassVar[str] = "zhvi_sfr"


class ZoriAdapter(_ZillowAdapter):
    """Zillow Observed Rent Index: a repeat-rent index of asking rents."""

    source_id: ClassVar[str] = "zillow_zori"
    default_vintage: ClassVar[str] = "current"
    product: ClassVar[str] = "zori"
    file_stem: ClassVar[str] = "zori_uc_sfrcondomfr_sm_month"
    metric_id: ClassVar[str] = "zori_all"


ADAPTERS: dict[str, type[_ZillowAdapter]] = {
    ZhviAdapter.source_id: ZhviAdapter,
    ZoriAdapter.source_id: ZoriAdapter,
}
