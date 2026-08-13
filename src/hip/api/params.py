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

# What a ranking is ordered by (migration 0006). `change` needs two observations;
# `value` ranks the most recent one, which is the only thing a snapshot source such as
# MOD-IV can be ranked on.
RankingBasis = Literal["change", "value"]

# The window recorded against a value ranking. A level has no span, but the column is
# part of the primary key, so it carries this literal rather than a lie about a period.
LATEST_WINDOW = "latest"
