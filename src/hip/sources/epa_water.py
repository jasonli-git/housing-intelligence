"""EPA's public water system service areas, for states without a map of their own
(Milestone 63).

EPA's Office of Water publishes one national layer of where each public water system
delivers (`Water_System_Boundaries`, version 3, March 2026): boundaries from states and
systems where they supplied them, and EPA's own models elsewhere. EPA says the modelled
areas "should not be treated as exact", and disclaims their spatial accuracy; the page
says the areas are EPA's estimate. A U.S. Government work.

New Jersey keeps NJDEP's own map (`njdep_water_areas`), so its figures do not move;
this layer is read for every other scoped state, Pennsylvania first: its 1,734
residential areas on 2026-11-21. Community systems are the ones serving homes
year-round, so a state's read keeps the residential kinds of area only — residential,
mobile home parks and other residential — and leaves schools, restaurants and the
other non-community kinds out. Their system ids (PWSID) are the ones EPA's SDWIS keys
on, as NJDEP's are.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import ClassVar

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import SourceError, scoped_layer

URL = (
    "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services"
    "/Water_System_Boundaries/FeatureServer/0"
)
RESIDENTIAL = ("Residential Area", "Mobile Home Park", "Other Residential")
# The fewest areas a state's read may hold, about 95% of what EPA held for it.
MINIMUM = {"PA": 1_600}
# States read from a map of their own, never from this layer.
OWN_MAP = frozenset({"NJ"})


class EpaWaterAreasAdapter(ArcGisAdapter):
    """One layer per scoped state without a map of its own (`areas_pa`)."""

    source_id: ClassVar[str] = "epa_water_areas"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {}

    def __init__(self, states: Sequence[str] = ()) -> None:
        self.scoped = [s.upper() for s in states if s.upper() not in OWN_MAP]
        unknown = [s for s in self.scoped if s not in MINIMUM]
        if unknown:
            raise SourceError(f"EPA water areas not reviewed for {unknown}")

    def layers(self) -> dict[str, ArcGisLayer]:
        kinds = ", ".join(f"'{k}'" for k in RESIDENTIAL)
        return {
            scoped_layer("areas", state): ArcGisLayer(
                url=URL,
                where=f"PWSID LIKE '{state}%' AND Service_Area_Type IN ({kinds})",
                fields=(
                    "OBJECTID",
                    "PWSID",
                    "PWS_Name",
                    "Service_Area_Type",
                    "Symbology_Field",
                ),
                minimum=MINIMUM[state],
                max_offset=0.00001,
                batch=50,
            )
            for state in self.scoped
        }
