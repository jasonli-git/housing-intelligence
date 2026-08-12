"""Metric endpoints against a loaded warehouse. Skips when there is nothing loaded."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import probe

client = TestClient(app)

pytestmark = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)


@pytest.fixture(scope="module")
def loaded() -> None:
    if not client.get("/metrics").json():
        pytest.skip("no metrics loaded; run the pipeline through `hip load`")


def test_catalog_reports_coverage(loaded: None) -> None:
    metrics = {m["metric_id"]: m for m in client.get("/metrics").json()}

    assert "zhvi_sfr" in metrics
    zhvi = metrics["zhvi_sfr"]
    assert zhvi["observations"] > 100_000
    assert zhvi["regions"] > 900
    assert zhvi["unit"] == "usd"


def test_coverage_can_be_narrowed_to_a_level(loaded: None) -> None:
    counties = {m["metric_id"]: m for m in client.get("/metrics?level=county").json()}

    assert counties["zhvi_sfr"]["regions"] == 21


def test_observations_carry_their_provenance(loaded: None) -> None:
    """A value without its source is what this platform exists not to serve."""
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]

    body = client.get(f"/regions/{mercer['region_id']}/metrics?metric_id=zhvi_sfr").json()

    assert body["name"] == "Mercer"
    assert body["observations"]
    first = body["observations"][0]
    assert first["source_id"] == "zillow_zhvi"
    assert first["match_method"] == "fips"
    assert first["vintage"]


def test_date_range_filters_apply(loaded: None) -> None:
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]

    body = client.get(
        f"/regions/{mercer['region_id']}/metrics"
        "?metric_id=zhvi_sfr&from=2025-01-01&to=2025-06-30"
    ).json()

    assert len(body["observations"]) == 6
    assert body["observations"][0]["period_start"] == "2025-01-01"
    assert body["observations"][-1]["period_start"] == "2025-06-01"


def test_period_spans_the_month(loaded: None) -> None:
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]

    observation = client.get(
        f"/regions/{mercer['region_id']}/metrics?metric_id=zhvi_sfr&from=2025-01-01"
    ).json()["observations"][0]

    assert observation["period_start"] == "2025-01-01"
    assert observation["period_end"] == "2025-01-31"


def test_municipal_match_method_reflects_the_source(loaded: None) -> None:
    """Municipal data arrives two ways and a consumer must be able to tell them apart.

    ACS publishes county-subdivision GEOIDs, so its municipal rows are `fips` — exact.
    Zillow publishes only a city name, so its municipal rows are `name_county`. Both
    land at the same level, which is precisely why `match_method` is stored per fact.
    """
    page = client.get("/regions?level=municipality&limit=60").json()

    methods: dict[str, set[str]] = {}
    for item in page["items"]:
        for observation in client.get(f"/regions/{item['region_id']}/metrics").json()[
            "observations"
        ]:
            methods.setdefault(observation["source_id"], set()).add(
                observation["match_method"]
            )

    assert methods, "no municipality in the first 60 had observations"
    assert methods.get("census_acs") == {"fips"}
    if "zillow_zhvi" in methods:
        assert methods["zillow_zhvi"] == {"name_county"}


def test_unresolved_geographies_are_explained(loaded: None) -> None:
    """A missing municipality gets an answer, not silence."""
    rows = client.get("/sources/unresolved").json()

    assert rows
    reasons = {r["reason"] for r in rows}
    assert any("census-designated place" in r for r in reasons)
    assert all(r["observations"] > 0 for r in rows)


def test_unknown_region_metrics_is_a_404(loaded: None) -> None:
    assert client.get("/regions/99999999/metrics").status_code == 404
