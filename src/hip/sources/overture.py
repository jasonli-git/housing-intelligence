"""Shops and restaurants from Overture Maps Places (the visual stories, Milestone 60).

Overture publishes the world's places monthly as GeoParquet in a public S3 bucket, one
release at a time (`2026-10-21.0`), merged from Meta, Microsoft, Foursquare, BrightQuery
and others. Nothing is downloaded whole: `_fetch_bytes` asks DuckDB to read only New
Jersey's box from the newest release and writes those rows, with the columns the stories
read, as this source's file — hashed, cached and archived like any download. Measured
2026-11-03: 1,172,448 places in the box (New York, Pennsylvania and Delaware edges
included; staging keeps the points inside New Jersey's towns), 82 MB, 24 seconds.

**Why it is here.** OpenStreetMap, volunteer-mapped, held about 69% of New Jersey's
Starbucks, 74% of its Dunkin' and 40% of its pizzerias against outside counts; Overture
held about 86%, 99% and more than all of them (closed and doubled listings, which
staging filters). The Starbucks index and the pizza–bagel line read it; the Wawa line
and Diner capital stay on OpenStreetMap (`osm_nj`). Docs: docs/STORIES.md.

**Licence.** The places theme is CDLA Permissive 2.0 and Apache 2.0, by source; it holds
no OpenStreetMap data and so carries no share-alike. Each source's credit is in
`config/sources.yml`. One of its sources is All the Places, scraped from chains' own
store locators under a CC0 the scraped sites never granted; the acquisition policy
(ARCHITECTURE #271) keeps that out, so staging drops a place whose only source it is.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import ClassVar

import httpx

from hip.duck import duckdb_session
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

CATALOG_URL = "https://stac.overturemaps.org/catalog.json"
BUCKET = "s3://overturemaps-us-west-2/release"
# New Jersey's extent with a margin, in degrees. Rows are pruned on Overture's own bbox
# column, so the read touches only the files and row groups that can hold the state.
BOX = {"xmin": -75.57, "xmax": -73.88, "ymin": 38.92, "ymax": 41.36}


class OvertureAdapter(SourceAdapter):
    source_id: ClassVar[str] = "overture_places"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "parquet"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    # Released monthly; a fetch reads the newest release named in Overture's catalogue.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="places",
                vintage=vintage or self.default_vintage,
                url=CATALOG_URL,
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "places.parquet"

    def latest_release(self) -> str:
        """The newest release Overture's catalogue names, such as `2026-10-21.0`."""
        response = httpx.get(CATALOG_URL, timeout=30, follow_redirects=True)
        response.raise_for_status()
        latest = response.json().get("latest")
        if not isinstance(latest, str) or not latest:
            raise SourceError(f"{self.source_id}: the catalogue names no latest release")
        return latest

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """New Jersey's box from the newest release, written as one Parquet file.

        Every row carries the release it came from, so a count can say which month of
        Overture it is. A place is a point at its bounding box's corner, which for a
        place is the point itself.
        """
        release = self.latest_release()
        with duckdb_session() as con:
            con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region = 'us-west-2';")
            con.execute(
                f"""
                COPY (
                    SELECT id, names.primary AS name,
                           brand.names.primary AS brand, brand.wikidata AS brand_wikidata,
                           taxonomy.primary AS category, basic_category,
                           confidence, operating_status,
                           list_distinct(list_transform(sources, s -> s.dataset))
                               AS datasets,
                           bbox.xmin AS lon, bbox.ymin AS lat,
                           '{release}' AS release
                    FROM read_parquet(
                        '{BUCKET}/{release}/theme=places/type=place/*',
                        hive_partitioning = 1
                    )
                    WHERE bbox.xmin BETWEEN {BOX["xmin"]} AND {BOX["xmax"]}
                      AND bbox.ymin BETWEEN {BOX["ymin"]} AND {BOX["ymax"]}
                ) TO '{destination}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            )
        # No single response to validate against: the release is re-read when it is due.
        self._last_validators = {}
