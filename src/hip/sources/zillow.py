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

import json
from datetime import date, timedelta
from pathlib import Path
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
    """Shared shape: one file per geography level, national coverage, no API key.

    Downloaded by hand since Milestone 31 (ARCHITECTURE #272). Zillow's Terms of Use
    forbid "any other automated activity with the purpose of obtaining information" from
    its services, and nothing on its pages says a scheduled fetch of these public CSVs
    is exempt — nor does Zillow offer anywhere to ask. So the six files are downloaded
    from its data page into `data/manual/<source_id>/`, named as Zillow names them, and
    the refresh picks up whatever is there. `refs` still names Zillow's own URL, as the
    provenance of where the file was published.
    """

    manual: ClassVar[bool] = True
    manual_from: ClassVar[str | None] = "https://www.zillow.com/research/data/"

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


def third_thursday(year: int, month: int) -> date:
    """Zillow's release day: every 2026 release fell on its month's third Thursday."""
    first = date(year, month, 1)
    return first + timedelta(days=(3 - first.weekday()) % 7 + 14)


def held_through(raw_dir: Path, source_id: str) -> date | None:
    """The newest month of figures held for a Zillow source: the last date column of
    its county file in the raw cache, the file the owner last handed in."""
    index_path = raw_dir / source_id / "index.json"
    if not index_path.exists():
        return None
    sha = json.loads(index_path.read_text()).get("county@current")
    if not sha:
        return None
    files = sorted((raw_dir / source_id / sha[:16]).glob("*.csv"))
    if not files:
        return None
    with files[0].open() as handle:
        header = handle.readline().strip().split(",")
    try:
        return date.fromisoformat(header[-1])
    except ValueError:
        return None


def published_through(today: date) -> date:
    """The newest month Zillow has published by `today`: last month once this month's
    third Thursday has passed, else the month before."""
    end_of_last = today.replace(day=1) - timedelta(days=1)
    if today > third_thursday(today.year, today.month):
        return end_of_last
    return end_of_last.replace(day=1) - timedelta(days=1)


def due(raw_dir: Path, today: date) -> dict[str, date | None]:
    """The Zillow sources whose newest held month is behind what Zillow has published,
    with the month each is held through — reckoned from the calendar and the files on
    this machine alone, since Zillow's terms forbid asking its site (#272)."""
    expected = published_through(today)
    behind: dict[str, date | None] = {}
    for source_id in ADAPTERS:
        held = held_through(raw_dir, source_id)
        if held is None or held < expected:
            behind[source_id] = held
    return behind
