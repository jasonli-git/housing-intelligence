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


def test_has_data_partitions_the_spine() -> None:
    """Every region is on exactly one side of the filter."""
    total = client.get("/regions?limit=1").json()["total"]
    with_data = client.get("/regions?has_data=true&limit=1").json()["total"]
    without = client.get("/regions?has_data=false&limit=1").json()["total"]
    assert with_data + without == total
    assert with_data and without, "a partition with an empty side proves nothing"


def test_tracts_carry_no_observations() -> None:
    """The reason `has_data` exists: the spine and the data have different shapes.

    No source loaded so far publishes at tract level, so a tract page would render
    blank. The static build uses this filter to decide which pages exist at all.
    """
    body = client.get("/regions?has_data=true&level=tract&limit=1").json()
    assert body["total"] == 0
    assert client.get("/regions?has_data=false&level=tract&limit=1").json()["total"] > 0


def test_has_data_composes_with_other_filters() -> None:
    counties = client.get("/regions?has_data=true&level=county&limit=1").json()
    assert counties["total"] > 0
    both = client.get("/regions?has_data=true&level=county&state=NJ&limit=1").json()
    assert both["total"] == counties["total"]


def test_name_lsad_disambiguates_places_sharing_a_name_and_county() -> None:
    """Four NJ pairs share a name *and* a county; only the legal status separates them.

    `parent_id` resolves most of the 30 duplicated municipality names, because a
    municipality belongs to one county — but not Boonton town against Boonton township,
    both in Morris. Without NAMELSAD a search returns two identical rows.
    """
    items = client.get("/regions?level=municipality&q=Boonton&limit=10").json()["items"]
    assert len(items) >= 2, "expected the Boonton pair"
    assert len({i["name"] for i in items}) == 1, "bare names are identical, by design"
    assert len({i["name_lsad"] for i in items}) == len(items), items


def test_every_region_carries_a_name_lsad() -> None:
    """NOT NULL with a fallback to `name`, so no consumer has to branch on absence."""
    for level in ("state", "county", "municipality", "zip"):
        items = client.get(f"/regions?level={level}&limit=5").json()["items"]
        assert items, level
        assert all(i["name_lsad"] for i in items), level


def test_counties_carry_their_full_name() -> None:
    items = client.get("/regions?level=county&q=Bergen&limit=1").json()["items"]
    assert items[0]["name"] == "Bergen"
    assert items[0]["name_lsad"] == "Bergen County"


def test_ancestors_carry_name_lsad_too() -> None:
    """The recursive chain selects its own columns and can drift from the outer query."""
    body = client.get("/regions?level=municipality&limit=1").json()["items"][0]
    detail = client.get(f"/regions/{body['region_id']}").json()
    assert detail["ancestors"], "a municipality has a county above it"
    assert all(a["name_lsad"] for a in detail["ancestors"])
