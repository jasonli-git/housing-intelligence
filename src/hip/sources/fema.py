"""FEMA: the flood map in force, and flood insurance claims paid (Milestone 40).

**The National Flood Hazard Layer** (`fema_nfhl`) is FEMA's current effective flood
map, every Flood Insurance Rate Map and the Letters of Map Revision issued since, as
one national layer FEMA updates continuously. Its flood hazard zones partition the
mapped land: the 1%-annual-chance zone (`SFHA_TF = 'T'`: A, AE, AH, AO, VE), the
0.2% zone (shaded X), minimal hazard (unshaded X), undetermined (D) and open water.
New Jersey is the rows whose `DFIRM_ID` begins with its FIPS code, 57,488 on
2026-10-02. Federal government work; FEMA states no licence for it.

**NFIP redacted claims** (`fema_nfip_claims`) are every National Flood Insurance
Program claim, from OpenFEMA's v3 endpoint: v2, `FimaNfipClaims`, froze on 2026-06-01
and is removed on 2026-10-15. 202,340 New Jersey claims on 2026-10-02, each with the
date of loss, county, reported ZIP code, census block group and what was paid. They
are where floods have actually cost insured owners, not a map of where they could. Only
the fields a figure uses are requested: the dataset is redacted to protect claimants,
OpenFEMA's terms forbid trying to re-identify them, and a claim's building details are
not needed for a count.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from pathlib import Path
from typing import Any, ClassVar

import httpx

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

logger = logging.getLogger(__name__)

NFHL_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28"


class NfhlAdapter(ArcGisAdapter):
    """New Jersey's flood hazard zones from FEMA's national layer."""

    source_id: ClassVar[str] = "fema_nfhl"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "zones": ArcGisLayer(
            url=NFHL_URL,
            where="DFIRM_ID LIKE '34%'",
            fields=("OBJECTID", "DFIRM_ID", "FLD_ZONE", "ZONE_SUBTY", "SFHA_TF"),
            minimum=50_000,
            max_offset=0.00001,
        )
    }


CLAIMS_URL = "https://www.fema.gov/api/open/v3/NfipClaims"

# What a count of claims and their payments needs, and where each one is.
CLAIM_FIELDS = (
    "id",
    "dateOfLoss",
    "yearOfLoss",
    "countyCode",
    "reportedZipCode",
    "censusGeoid",
    "netBuildingPaymentAmount",
    "netContentsPaymentAmount",
)

# OpenFEMA serves at most 10,000 rows a request.
_PAGE = 10_000


class NfipClaimsAdapter(SourceAdapter):
    """Every NFIP claim in New Jersey, paged from OpenFEMA into one NDJSON file."""

    source_id: ClassVar[str] = "fema_nfip_claims"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "ndjson"
    # OpenFEMA refreshes the dataset about monthly; 21 requests are cheap, but there is
    # no validator to ask with, so a month bounds the staleness at the data's own pace.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="claims",
                vintage=vintage or self.default_vintage,
                url=f"{CLAIMS_URL}?$filter=state eq 'NJ'"
                f"&$select={','.join(CLAIM_FIELDS)}",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "claims_nj.ndjson"

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=httpx.Timeout(30.0, read=180.0), headers=self.headers)

    def _page(self, client: httpx.Client, skip: int) -> tuple[list[dict[str, Any]], int]:
        response = client.get(
            CLAIMS_URL,
            params={
                "$filter": "state eq 'NJ'",
                "$select": ",".join(CLAIM_FIELDS),
                "$orderby": "id",
                "$top": str(_PAGE),
                "$skip": str(skip),
                "$inlinecount": "allpages",
            },
        )
        response.raise_for_status()
        body = response.json()
        return list(body.get("NfipClaims") or []), int(body["metadata"]["count"])

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        written, total = 0, None
        with self._client() as client, destination.open("w", encoding="utf-8") as out:
            while total is None or written < total:
                rows, total = self._page(client, written)
                if not rows:
                    break
                for row in rows:
                    out.write(json.dumps({k: row.get(k) for k in CLAIM_FIELDS}) + "\n")
                written += len(rows)
        if total is None or written != total or written < 150_000:
            raise SourceError(
                f"{ref.source_id}/{ref.layer}: read {written:,} of {total} claims"
            )
        logger.info("%s: %s claims", ref.source_id, f"{written:,}")
        self._last_validators = {}
