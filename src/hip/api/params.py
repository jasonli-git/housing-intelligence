"""Query-parameter vocabularies shared by the routers.

One definition each, because a level accepted by `/rankings` and rejected by `/metrics`
is a bug a caller discovers as a 422 with no explanation. `nation` belongs in the list:
national series are ordinary regions (ARCHITECTURE #30).

The values mirror the `region_level` enum in the warehouse and the window labels
`hip analyze` writes to `fact_metric_change."window"`.
"""

from __future__ import annotations

from typing import Literal

RegionLevel = Literal[
    "nation", "state", "county", "municipality", "zip", "tract", "parcel"
]

Window = Literal["1y", "3y", "5y", "10y", "since_2019"]
