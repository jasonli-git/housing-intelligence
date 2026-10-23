"""The third batch of visual stories' sources and rows (2026-10-23).

What is tested is what would be wrong silently: a Wikidata answer cut short by the
query service's time limit and landed as if whole, nClimGrid keeping another state's
rows or a year that is not final, NLCD's outside-the-survey code averaged in as paving
while 0% paving is dropped as missing, and a building's area measured in degrees.
"""

from __future__ import annotations

import json
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from hip.landing.footprints import land_footprints
from hip.sources import nclimgrid
from hip.sources.base import Release, SourceAdapter, SourceError
from hip.sources.fred import SERIES
from hip.sources.nclimgrid import NClimGridAdapter
from hip.sources.wikidata import WikidataAdapter


def test_wikidata_asks_two_questions_and_reads_them_as_utf8() -> None:
    refs = WikidataAdapter().refs()
    assert [r.layer for r in refs] == ["municipalities", "births"]
    assert all(r.url.startswith("https://query.wikidata.org/sparql?query=") for r in refs)
    assert WikidataAdapter.csv_encoding == "utf-8"


def test_a_wikidata_answer_cut_short_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The service sends 200 and some rows, then appends the Java exception."""

    def partial(self: SourceAdapter, ref: object, destination: Path) -> None:
        destination.write_text(
            "item,fips,county,inception\nhttp://x/Q1,34-00100,34001,\n"
            "SPARQL-QUERY: queryStr=SELECT ...\njava.util.concurrent.TimeoutException\n"
        )

    monkeypatch.setattr(SourceAdapter, "_fetch_bytes", partial)
    adapter = WikidataAdapter()
    with pytest.raises(SourceError, match="timed out"):
        adapter._fetch_bytes(adapter.refs()[0], tmp_path / "m.csv")


def test_nclimgrid_pins_each_finished_year() -> None:
    refs = NClimGridAdapter().refs()
    assert refs[0].vintage == "1951"
    assert int(refs[-1].vintage) == datetime.now(UTC).year - 1
    assert not any(r.mutable for r in refs)


def test_nclimgrid_keeps_only_new_jersey_summer_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    asked: list[str] = []

    def answer(request: httpx.Request) -> httpx.Response:
        asked.append(request.url.path.rsplit("/", 1)[-1])
        return httpx.Response(
            200,
            text="region_type,fips,date,tmax\n"
            "cty,01001,2020-07-01,    31.86\n"
            "cty,34001,2020-07-01,    33.10\n"
            "cty,36001,2020-07-01,    29.00\n",
        )

    real = httpx.Client
    monkeypatch.setattr(
        nclimgrid.httpx,
        "Client",
        lambda **kw: real(transport=httpx.MockTransport(answer), **kw),
    )
    adapter = NClimGridAdapter()
    ref = next(r for r in adapter.refs() if r.vintage == "2020")
    out = tmp_path / "nj.csv"
    adapter._fetch_bytes(ref, out)

    assert asked == [f"2020{m:02d}-scaled.csv" for m in (5, 6, 7, 8, 9)]
    lines = out.read_text().splitlines()
    assert lines[0].startswith("region_type,fips")
    assert {line.split(",")[1] for line in lines[1:]} == {"34001"}


def test_impervious_keeps_unpaved_ground_and_drops_open_water(tmp_path: Path) -> None:
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds

    from hip.sources.imagery import BOX, HEIGHT, WIDTH
    from hip.sources.nlcd import ImperviousAdapter

    # The service's own tag says 0 is no data; NLCD's outside-the-survey code is 127.
    tif = tmp_path / "impervious.tif"
    data = np.zeros((40, 40), dtype="uint8")
    data[:, 20:] = 127
    data[:20, :20] = 60
    with rasterio.open(
        tif, "w", driver="GTiff", width=40, height=40, count=1, dtype="uint8",
        crs="EPSG:4326", transform=from_bounds(*BOX, 40, 40), nodata=0,
    ) as out:  # fmt: skip
        out.write(data, 1)

    _, pixels = ImperviousAdapter().cut(str(tif))
    values = np.frombuffer(pixels, dtype="<f4").reshape(HEIGHT, WIDTH)
    assert values[0, 0] == 60.0  # paved, north-west
    assert values[-1, 0] == 0.0  # unpaved is a reading, not a gap
    assert np.isnan(values[0, -1])  # outside the survey is no data


def test_fred_asks_for_every_county_s_days_on_market() -> None:
    dom = {k: v[0] for k, v in SERIES.items() if k.startswith("dom_")}
    assert len(dom) == 22  # the state and its 21 counties
    assert dom["dom_34"] == "MEDDAYONMARNJ"
    assert dom["dom_34041"] == "MEDDAYONMAR34041"


def test_footprints_are_measured_in_square_feet(tmp_path: Path) -> None:
    # A 20 m by 20 m square near Trenton: about 4,306 square feet.
    lon, lat, d_lon, d_lat = -74.76, 40.22, 20 / 85_000, 20 / 111_000
    square = [
        [lon, lat],
        [lon + d_lon, lat],
        [lon + d_lon, lat + d_lat],
        [lon, lat + d_lat],
        [lon, lat],
    ]
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Polygon", "coordinates": [square]},
            }
        ],
    }
    raw = tmp_path / "raw" / "msft_buildings" / "abc"
    raw.mkdir(parents=True)
    path = raw / "NewJersey.geojson.zip"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("NewJersey.geojson", json.dumps(geojson))
    from hip.sources.buildings import FootprintsAdapter

    release = Release(
        ref=FootprintsAdapter().refs()[0], path=path, sha256="f" * 64, size_bytes=1,
        fetched_at=datetime.now(UTC),
    )  # fmt: skip
    table = land_footprints(release, parquet_dir=tmp_path / "parquet")

    import duckdb

    sqft = duckdb.sql(f"SELECT sqft FROM '{table.path}'").fetchone()[0]
    assert table.row_count == 1
    assert 3_900 < sqft < 4_700


def test_an_unloaded_story_has_no_points() -> None:
    from hip.api.main import app
    from hip.warehouse.db import probe

    if not probe().migrated:
        pytest.skip("needs migrated warehouse")
    assert TestClient(app).get("/stories/no-such-story/points").status_code == 404
