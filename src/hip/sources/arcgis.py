"""A layer published on an ArcGIS map service, read whole into NDJSON (Milestone 40).

FEMA's flood map and NJDEP's flood, contaminated-site and water-system layers are each
one ArcGIS layer behind a public query endpoint. nj.gov's own file downloads answer a
script with Imperva's 403, so the services are the documented way in; each source's
`terms_note` records that the portal entry for its layer belongs to the publisher and
points at the service read here.

**How a layer is read.** The ids of every row the `where` clause selects, in one
request, then the rows in batches by id. Not offset paging, which the MOD-IV adapter
measured at 26.7s a page deep in a layer (`hip.sources.nj_modiv`), and not OBJECTID
windows, which assume ids dense from 1: FEMA's national layer gives New Jersey 57,488
ids scattered between 54,740 and 27,746,494. A batch the server truncates is split and
asked again, so a page of large polygons never loses rows silently.

Rows are written as the publisher's attributes plus `geometry`, the GeoJSON geometry as
text in NAD83 (EPSG:4269, TIGER's), for staging to read with `ST_GeomFromGeoJSON`.
Landing stays a transcoding (`land_ndjson`). A layer reading fewer rows than its floor
is refused: the publisher owes nobody a stable layer, and NJDEP's agreement says so.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any, ClassVar

import httpx

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArcGisLayer:
    """One layer to read: where it is, which rows and fields, and how many to expect."""

    url: str
    fields: tuple[str, ...]
    # Fewer rows than this means the layer changed shape or the query was refused.
    minimum: int
    where: str = "1=1"
    geometry: bool = True
    # Generalisation, in degrees: 0.00001 is about a metre in New Jersey, far inside
    # the accuracy of any flood line, and it halves what FEMA's polygons weigh.
    max_offset: float | None = None
    batch: int = 250


class ArcGisAdapter(SourceAdapter):
    """A source whose layers are each one ArcGIS layer, republished in place."""

    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "ndjson"
    # Assembled from many responses, so there is no validator to ask with; a week
    # bounds how stale a layer gets without re-reading it on every run.
    revalidate_after: ClassVar[timedelta] = timedelta(days=7)
    # Polygons are repaired and cut row by row in staging; small groups let DuckDB do
    # that on every core (`land_ndjson`).
    row_group_size: ClassVar[int | None] = 2048
    LAYERS: ClassVar[dict[str, ArcGisLayer]]

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=name,
                vintage=vintage or self.default_vintage,
                # The fields and filter are part of the request, so they are part of
                # the URL the raw cache compares (#214).
                url=f"{layer.url}/query?where={layer.where}"
                f"&outFields={','.join(layer.fields)}",
            )
            for name, layer in self.LAYERS.items()
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.ndjson"

    def _client(self) -> httpx.Client:
        """The HTTP client for a fetch; a seam for tests, as in `ModivAdapter`."""
        return httpx.Client(timeout=httpx.Timeout(30.0, read=180.0), headers=self.headers)

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        layer = self.LAYERS[ref.layer]
        with self._client() as client:
            ids = self._ids(client, layer)
            written = 0
            with destination.open("w", encoding="utf-8") as handle:
                for start in range(0, len(ids), layer.batch):
                    for row in self._rows(
                        client, layer, ids[start : start + layer.batch]
                    ):
                        handle.write(json.dumps(row, separators=(",", ":")) + "\n")
                        written += 1
        if written < layer.minimum:
            raise SourceError(
                f"{ref.source_id}/{ref.layer}: read {written:,} rows, expected at least "
                f"{layer.minimum:,}; the layer has changed"
            )
        logger.info("%s/%s: %s rows", ref.source_id, ref.layer, f"{written:,}")
        self._last_validators = {}

    def _query(self, client: httpx.Client, layer: ArcGisLayer, **params: Any) -> Any:
        """One POSTed query (a batch of ids is too long for a URL), errors raised."""
        response = client.post(f"{layer.url}/query", data={"f": "json", **params})
        response.raise_for_status()
        body = response.json()
        if "error" in body:
            # ArcGIS reports a refused query with a 200 and an error body.
            raise httpx.HTTPError(f"{layer.url}: {body['error']}")
        return body

    def _ids(self, client: httpx.Client, layer: ArcGisLayer) -> list[int]:
        body = self._query(client, layer, where=layer.where, returnIdsOnly="true")
        return sorted(body.get("objectIds") or [])

    def _rows(
        self, client: httpx.Client, layer: ArcGisLayer, ids: list[int]
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "objectIds": ",".join(map(str, ids)),
            "outFields": ",".join(layer.fields),
            "returnGeometry": "true" if layer.geometry else "false",
            "outSR": "4269",
            "f": "geojson",
            "geometryPrecision": "6",
        }
        if layer.max_offset is not None:
            params["maxAllowableOffset"] = str(layer.max_offset)
        response = client.post(f"{layer.url}/query", data=params)
        response.raise_for_status()
        body = response.json()
        if "error" in body:
            raise httpx.HTTPError(f"{layer.url}: {body['error']}")
        features = body.get("features") or []
        if body.get("exceededTransferLimit"):
            if len(ids) == 1:
                raise SourceError(f"{layer.url}: row {ids[0]} could not be read")
            # Too much for one answer: ask for each half.
            half = len(ids) // 2
            return self._rows(client, layer, ids[:half]) + self._rows(
                client, layer, ids[half:]
            )
        # Fewer rows than ids with no truncation: rows removed since the ids were read,
        # which a layer NJDEP updates daily does. The floor catches anything larger.
        rows = []
        for feature in features:
            row = dict(feature.get("properties") or {})
            if layer.geometry:
                geometry = feature.get("geometry")
                row["geometry"] = json.dumps(geometry) if geometry else None
            rows.append(row)
        return rows
