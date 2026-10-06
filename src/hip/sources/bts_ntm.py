"""Where transit stops are: the National Transit Map's stops (Milestone 45).

The Bureau of Transportation Statistics compiles every agency's published GTFS schedule
into one national layer of stops, each tagged with the kinds of service its trips carry
(`stop_type_text`: "Rail", "Bus", "Subway, Metro", "Tram, Streetcar, Light rail",
"Ferry"). A U.S. Government work, in the public domain, compiled about yearly; the copy
read on 2026-10-06 was compiled 2026-03-09 and holds NJ TRANSIT's 162 rail and 60 light
rail stops and 16,596 bus stops, PATH, PATCO, SEPTA and New York City's subway.

It says where service stops, not how often: the layer joins trips to stops only to name
their kind. How often anything runs is in NJ TRANSIT's own GTFS, whose agreement the
owner has not accepted (TODO.md, Parked). So the platform measures nearness to a stop,
and the page says that nearness is not service.

Read for a box around New Jersey rather than the state alone: a home in Fort Lee is as
near a stop across the Hudson as one on its own side, and distance does not stop at a
state line. The query asks only for coordinates, not geometry.
"""

from __future__ import annotations

from datetime import timedelta
from typing import ClassVar

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer

STOPS_URL = (
    "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services"
    "/NTAD_National_Transit_Map_Stops/FeatureServer/0"
)

# New Jersey's extent, about 15km wider each way, in degrees.
BOX = (
    "stop_lat >= 38.8 AND stop_lat <= 41.45 AND stop_lon >= -75.65 AND stop_lon <= -73.8"
)


class TransitStopsAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "bts_ntm"
    # Recompiled about yearly; a monthly look is ample.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "stops": ArcGisLayer(
            url=STOPS_URL,
            fields=(
                "OBJECTID",
                "ntd_id",
                "stop_id",
                "location_type",
                "stop_type_text",
                "stop_lat",
                "stop_lon",
                "download_date",
            ),
            minimum=40_000,
            where=BOX,
            geometry=False,
            batch=2000,
        )
    }
