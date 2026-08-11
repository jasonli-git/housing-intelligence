"""Region endpoints against a loaded warehouse.

These are integration tests: they need Postgres up, migrated, and loaded
(`make db-up && make migrate && hip acquire && hip land && hip geocode && hip load`).
They skip rather than fail when it is not, so a fresh clone can still run `make test`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import probe

client = TestClient(app)

NJ_COUNTIES = 21
NJ_MUNICIPALITIES = 564

pytestmark = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)


@pytest.fixture(scope="module")
def loaded() -> None:
    if client.get("/regions?level=state").json()["total"] == 0:
        pytest.skip("warehouse migrated but empty; run the pipeline through `hip load`")


def test_health_reports_a_loaded_warehouse(loaded: None) -> None:
    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert body["database"]["migrated"] is True
    assert body["database"]["last_load_at"] is not None


def test_counties_match_the_real_state(loaded: None) -> None:
    body = client.get("/regions?level=county&state=NJ").json()

    assert body["total"] == NJ_COUNTIES


def test_municipalities_match_the_real_state(loaded: None) -> None:
    """564 is NJ's actual municipality count, not just whatever TIGER returned."""
    body = client.get("/regions?level=municipality&state=NJ").json()

    assert body["total"] == NJ_MUNICIPALITIES


def test_name_search_is_case_insensitive(loaded: None) -> None:
    body = client.get("/regions?level=county&q=mercer").json()

    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mercer"


def test_pagination_is_stable_and_non_overlapping(loaded: None) -> None:
    first = client.get("/regions?level=municipality&limit=10&offset=0").json()
    second = client.get("/regions?level=municipality&limit=10&offset=10").json()

    assert first["total"] == second["total"] == NJ_MUNICIPALITIES
    assert len(first["items"]) == len(second["items"]) == 10
    assert not {r["region_id"] for r in first["items"]} & {
        r["region_id"] for r in second["items"]
    }


def test_children_roll_up_to_their_parent(loaded: None) -> None:
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]

    children = client.get(f"/regions?parent_id={mercer['region_id']}").json()

    assert children["total"] > 0
    assert all(c["parent_id"] == mercer["region_id"] for c in children["items"])


def test_region_detail_returns_the_full_ancestor_chain(loaded: None) -> None:
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]
    municipality = client.get(
        f"/regions?level=municipality&parent_id={mercer['region_id']}&limit=1"
    ).json()["items"][0]

    detail = client.get(f"/regions/{municipality['region_id']}").json()

    assert [a["level"] for a in detail["ancestors"]] == ["county", "state"]
    assert detail["ancestors"][0]["name"] == "Mercer"
    assert detail["ancestors"][1]["state_code"] == "NJ"


def test_every_municipality_and_tract_has_a_county_parent(loaded: None) -> None:
    for level in ("municipality", "tract"):
        page = client.get(f"/regions?level={level}&limit=5").json()
        for item in page["items"]:
            detail = client.get(f"/regions/{item['region_id']}").json()
            assert detail["ancestors"][0]["level"] == "county", level


def test_zips_have_no_parent(loaded: None) -> None:
    """ZIPs are mail routes and nest in nothing; they reach other levels by crosswalk."""
    page = client.get("/regions?level=zip&limit=5").json()

    assert page["total"] > 0
    assert all(item["parent_id"] is None for item in page["items"])


def test_unknown_region_is_a_404(loaded: None) -> None:
    assert client.get("/regions/99999999").status_code == 404


def test_geo_returns_one_feature_per_region(loaded: None) -> None:
    body = client.get("/geo/county?state=NJ").json()

    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == NJ_COUNTIES
    feature = body["features"][0]
    assert feature["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    assert feature["properties"]["level"] == "county"
    assert feature["properties"]["geoid"].startswith("34")


def test_simplification_shrinks_the_payload(loaded: None) -> None:
    """The default exists so /geo cannot accidentally return tens of megabytes."""
    full = client.get("/geo/county?state=NJ&simplify=0")
    simplified = client.get("/geo/county?state=NJ")

    assert len(simplified.content) < len(full.content) / 2


def test_invalid_level_is_rejected(loaded: None) -> None:
    assert client.get("/geo/planet").status_code == 422
