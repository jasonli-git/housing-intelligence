"""NJ statewide parcels joined to MOD-IV property tax assessment records.

3.48M parcels, one row each, carrying assessed land and improvement value, property
class, year built, last sale, lot size, and dwelling count. This is the source that
finally supplies NJ's own municipal code (`CD_CODE`), which `region_identifiers` has
been holding a column for since Milestone 1 (ARCHITECTURE #21).

**Why the REST API and not the bulk file.** NJGIN publishes the whole thing as a 943MB
file geodatabase at `geoapps.nj.gov`, which would be one download instead of 1,741
requests. That host sits behind Imperva bot protection: `HEAD` returns 200 and `GET`
returns a 403 JavaScript challenge. Working around bot detection is not something this
project does, so acquisition uses the ArcGIS Feature Service, which is a public API
serving plain GETs and is meant to be queried programmatically. If the file ever becomes
reachable to a plain client, `_fetch_bytes` is the seam — everything downstream reads
NDJSON and would not change.

**Why OBJECTID windows and not resultOffset.** Measured on 2026-08-12: a 2000-row page
at `resultOffset=0` takes 0.76s and the same page at `resultOffset=1500000` takes 26.7s,
because the server materializes and discards every skipped row. An indexed
`OBJECTID >= lo AND OBJECTID < hi` window is ~1.0s at any depth. Offset paging would
take roughly 13 hours; windows take about 32 minutes.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, ClassVar

import httpx

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

logger = logging.getLogger(__name__)

LAYER_URL = (
    "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services"
    "/Parcels_MODIV_NJ_WM/FeatureServer/0"
)

# The service caps a page at 2000 rows. OBJECTID is dense (max id == row count), so a
# 2000-wide window returns a full page and never trips the transfer limit.
WINDOW = 2000

# What the municipality aggregates need, plus the identifiers that place a parcel.
# Deliberately not `select *`: the layer has 45 fields including owner address and deed
# book, none of which any metric uses, and each one multiplies 3.48M rows.
FIELDS = (
    "OBJECTID",
    "PAMS_PIN",
    "CD_CODE",
    "COUNTY",
    "MUN_NAME",
    "PROP_CLASS",
    "LAND_VAL",
    "IMPRVT_VAL",
    "NET_VALUE",
    "LAST_YR_TX",
    "YR_CONSTR",
    "SALE_PRICE",
    "SALES_CODE",
    "DEED_DATE",
    "CALC_ACRE",
    "DWELL",
    # When the publisher released this parcel record. Counties publish on their own
    # cycles, so this varies across the state and is the only date in the data that
    # says *when* an assessment snapshot is from. Without it the observation period
    # would have to be invented, and a fact with a made-up date is worse than no fact.
    "PCL_PBDATE",
)

_PAGE_RETRIES = 3


class ModivAdapter(SourceAdapter):
    """One statewide release, assembled from paged queries into a single NDJSON file.

    One release rather than one per county because that is what the publisher offers —
    a single statewide layer with no per-county partition — and inventing 21 releases
    would claim a provenance boundary the source does not have.
    """

    source_id: ClassVar[str] = "nj_modiv"
    # The endpoint always serves current data and never versions its URL, so the vintage
    # is ours to assign and the content hash is what actually distinguishes releases —
    # the same situation as Zillow (ARCHITECTURE #10).
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "ndjson"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="statewide",
                vintage=vintage or self.default_vintage,
                url=f"{LAYER_URL}/query",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "parcels_modiv_nj.ndjson"

    def _client(self) -> httpx.Client:
        """The HTTP client for a fetch. Overridden in tests to stub the transport.

        A seam rather than a parameter: `_fetch_bytes` is called by inherited retry
        machinery whose signature is fixed, so the client has to be swappable from
        the subclass rather than the call site.
        """
        return httpx.Client(timeout=httpx.Timeout(30.0, read=180.0), headers=self.headers)

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """Page the whole layer by OBJECTID window, writing one JSON object per line.

        NDJSON rather than one JSON document because 3.48M rows must never have to be
        held in memory at once — not here, and not in the landing stage, which reads
        this file with DuckDB (SPEC principle 7).
        """
        with self._client() as client:
            highest = self._max_objectid(client, ref)
            windows = (highest + WINDOW - 1) // WINDOW
            logger.info(
                "%s: %s parcels in %s requests", self.source_id, f"{highest:,}", windows
            )

            written = 0
            with destination.open("w", encoding="utf-8") as handle:
                for index, low in enumerate(range(1, highest + 1, WINDOW), start=1):
                    for row in self._window(client, ref, low, low + WINDOW):
                        handle.write(json.dumps(row, separators=(",", ":")) + "\n")
                        written += 1
                    if index % 100 == 0 or index == windows:
                        logger.info(
                            "%s: %s/%s requests, %s rows",
                            self.source_id,
                            index,
                            windows,
                            f"{written:,}",
                        )

        if written == 0:
            raise SourceError(f"{ref.source_id}/{ref.layer}: query returned no rows")

    def _max_objectid(self, client: httpx.Client, ref: ReleaseRef) -> int:
        payload = self._query(
            client,
            ref,
            {
                "where": "1=1",
                "outFields": "OBJECTID",
                "orderByFields": "OBJECTID DESC",
                "resultRecordCount": 1,
                "returnGeometry": "false",
            },
        )
        features = payload.get("features") or []
        if not features:
            raise SourceError(f"{ref.source_id}/{ref.layer}: layer reports no features")
        return int(features[0]["attributes"]["OBJECTID"])

    def _window(
        self, client: httpx.Client, ref: ReleaseRef, low: int, high: int
    ) -> list[dict[str, Any]]:
        """One OBJECTID window. Splits itself if the server caps the response.

        The split is defensive: OBJECTID is dense today, so a 2000-wide window fits in
        one page. Were the layer ever rebuilt with gaps or duplicates, silently losing
        the overflow would be far worse than two extra requests.
        """
        payload = self._query(
            client,
            ref,
            {
                "where": f"OBJECTID>={low} AND OBJECTID<{high}",
                "outFields": ",".join(FIELDS),
                "returnGeometry": "false",
            },
        )
        if payload.get("exceededTransferLimit") and high - low > 1:
            middle = low + (high - low) // 2
            return self._window(client, ref, low, middle) + self._window(
                client, ref, middle, high
            )
        return [
            feature["attributes"]
            for feature in payload.get("features", [])
            if isinstance(feature, dict) and "attributes" in feature
        ]

    def _query(
        self, client: httpx.Client, ref: ReleaseRef, params: dict[str, Any]
    ) -> dict[str, Any]:
        """One request, retried, with ArcGIS's in-body errors treated as failures.

        ArcGIS answers a rejected query with HTTP 200 and an `error` object. Trusting
        the status code would write an error document into the cache as though it were
        data — the same trap ACS set at Milestone 3.
        """
        last: Exception | None = None
        for attempt in range(1, _PAGE_RETRIES + 1):
            try:
                response = client.get(
                    f"{LAYER_URL}/query", params={**params, "f": "json"}
                )
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ValueError("response was not a JSON object")
                if "error" in payload:
                    raise ValueError(f"ArcGIS error: {payload['error']}")
                return payload
            except (httpx.HTTPError, ValueError) as exc:
                last = exc
                if attempt == _PAGE_RETRIES:
                    break
        raise SourceError(
            f"{ref.source_id}/{ref.layer}: page {params.get('where')} "
            f"failed after {_PAGE_RETRIES} attempts: {last}"
        ) from last
