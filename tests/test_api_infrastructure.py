"""M42 read-only API coverage against a loaded local warehouse."""

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import probe

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs migrated warehouse")
client = TestClient(app)


@pytest.fixture(scope="module")
def county() -> dict:
    region = client.get("/regions?level=county&q=Somerset").json()["items"][0]
    if client.get(f"/regions/{region['region_id']}/utilities").status_code == 404:
        pytest.skip("M42 sources not loaded")
    return region


def test_company_statistics_are_cited_and_not_town_measurements(county: dict) -> None:
    data = client.get(f"/regions/{county['region_id']}/utilities").json()
    assert len(data["providers"]) >= 2
    for provider in data["providers"]:
        assert provider["territory"]["file_sha256"]
        if provider["fuel"] == "gas":
            assert provider["electricity"] is None
        if provider["electricity"]:
            assert provider["electricity"]["payload"]["year"] == int(
                provider["electricity"]["vintage"]
            )


def test_town_energy_is_explicit_county_context(county: dict) -> None:
    town = client.get(f"/regions?parent_id={county['region_id']}&limit=1").json()[
        "items"
    ][0]
    data = client.get(f"/regions/{town['region_id']}/utilities").json()
    assert data["energy_context"]["entity_id"] == f"county:{county['geoid']}"
    assert data["energy_context"]["payload"]["name"] == "Somerset County"


def test_county_water_has_separate_measurements_inventory_and_violations(
    county: dict,
) -> None:
    response = client.get(f"/regions/{county['region_id']}/water-systems")
    assert response.status_code == 200
    systems = response.json()["systems"]
    assert systems
    for system in systems:
        assert system["release_id"] > 0
        assert len(system["file_sha256"]) == 64
        assert system["fetched_at"]
        assert 0 <= system["resolved_violations"] <= system["violations"]
        for result in system["pfas_samples"]:
            assert result["file_sha256"]
            assert result["payload"]["detections"] <= result["payload"]["samples"]
            if result["payload"]["detections"] == 0:
                assert result["payload"]["maximum_ng_l"] is None


def test_freshness_dates_samples_not_downloads(county: dict) -> None:
    sources = {s["source_id"]: s for s in client.get("/freshness").json()["sources"]}
    assert sources["eia861"]["period_observed_end"] == "2024-12-31"
    assert sources["doe_lead"]["period_observed_end"] == "2022-12-31"
    assert sources["epa_ucmr5"]["period_observed_end"].startswith("2026-")
