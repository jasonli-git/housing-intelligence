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

Read for a box around each scoped state rather than the state alone: a home in Fort Lee
is as near a stop across the Hudson as one on its own side, and distance does not stop
at a state line. The query asks only for coordinates, not geometry. One layer per state
since Milestone 63 (`scoped_layer`); where two boxes overlap, staging keeps each stop
once.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import ClassVar

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import SourceError, scoped_layer

STOPS_URL = (
    "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services"
    "/NTAD_National_Transit_Map_Stops/FeatureServer/0"
)

# Each state's extent, about 15km wider each way, in degrees (south, north, west, east),
# and the fewest stops its box may hold: 52,455 and 46,976 on 2026-11-21.
BOXES = {
    "NJ": ((38.8, 41.45, -75.65, -73.8), 40_000),
    "PA": ((39.55, 42.45, -80.75, -74.5), 44_000),
}


def box(state: str) -> str:
    (south, north, west, east), _ = BOXES[state]
    return (
        f"stop_lat >= {south} AND stop_lat <= {north} "
        f"AND stop_lon >= {west} AND stop_lon <= {east}"
    )


class TransitStopsAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "bts_ntm"
    # Recompiled about yearly; a monthly look is ample.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {}

    def __init__(self, states: Sequence[str] = ("NJ",)) -> None:
        self.scoped = [s.upper() for s in states]
        unknown = [s for s in self.scoped if s not in BOXES]
        if unknown:
            raise SourceError(f"Transit stop boxes not reviewed for {unknown}")

    def layers(self) -> dict[str, ArcGisLayer]:
        return {
            scoped_layer("stops", state): ArcGisLayer(
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
                minimum=BOXES[state][1],
                where=box(state),
                geometry=False,
                batch=2000,
            )
            for state in self.scoped
        }
