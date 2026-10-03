"""NJDEP's GIS layers: the climate-adjusted coast, contaminated sites, and who supplies
the water (Milestone 40).

All three are published by NJDEP's Bureau of GIS (`NJDEPBGIS`) under its Data
Distribution Agreement: data as is, no promise to keep it available or current, every
product credits NJDEP with a fixed disclaimer, and nothing is redistributed without its
metadata. The site shows figures computed from them, the disclaimer, and a link to each
layer's metadata (`config/sources.yml`).

**Tidal climate-adjusted flood elevation** (`njdep_cafe`): FEMA's coastal 1% flood
plus four feet of sea-level rise, the elevation the REAL rules (adopted 2026-01-20)
require tidal construction to plan for. An approximate delineation, from FEMA's
preliminary coastal studies of 2013 to 2016, for the fourteen counties NJDEP lists:
Atlantic, Bergen, Burlington, Camden, Cape May, Cumberland, Essex, Hudson, Mercer,
Middlesex, Monmouth, Ocean, Salem and Union. A town elsewhere has no figure, not zero.

**Known Contaminated Sites List** (`njdep_kcsl`): every site where soil or ground water
contamination is confirmed and remediation is open, reloaded daily from NJDEP's case
system. A site's name and street are never requested: the list includes homes with a
leaking heating-oil tank (`Active - UHOT`), and a resident's name and address are not
this project's to republish (the boundary #183 and #289 keep for owners).

**Public community water service areas** (`njdep_water_areas`): where each of the
state's community water systems delivers. A home outside every area is most likely on
a private well, which the Safe Drinking Water Act does not cover; New Jersey's Private
Well Testing Act requires one to be tested when the home is sold or leased.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer

MAPS = "https://mapsdep.nj.gov/arcgis/rest/services/Features"

CAFE_URL = (
    "https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services"
    "/Tidal_Climate_Adjusted_Flood_Elevation_CAFE_SLR_4ft/FeatureServer/23"
)


class CafeAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "njdep_cafe"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "tidal": ArcGisLayer(
            url=CAFE_URL,
            fields=("OBJECTID", "FLD_ZONE", "COUNTY"),
            minimum=50_000,
            max_offset=0.00001,
        )
    }


class KcslAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "njdep_kcsl"
    # Reloaded daily by NJDEP; a weekly read is current enough for a count.
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "sites": ArcGisLayer(
            url=f"{MAPS}/Environmental_NJEMS/MapServer/0",
            fields=("OBJECTID", "SITE_ID", "STATUS", "COMU_CODE", "STATUS_DT"),
            minimum=10_000,
            batch=1000,
        )
    }


class WaterAreasAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "njdep_water_areas"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "areas": ArcGisLayer(
            url=f"{MAPS}/Utilities/MapServer/13",
            fields=("OBJECTID", "PWID", "SYS_NAME", "AREA_TYPE"),
            minimum=500,
            max_offset=0.00001,
            batch=50,
        )
    }
