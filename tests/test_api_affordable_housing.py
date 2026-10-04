"""Read-only integration checks, skipping when the M41 inventory is not loaded."""

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import probe

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs migrated warehouse")
client = TestClient(app)


@pytest.fixture(scope="module")
def state_id() -> int:
    result = client.get("/regions?level=state&state=NJ").json()["items"]
    if not result:
        pytest.skip("no loaded NJ geography")
    rid = result[0]["region_id"]
    if client.get(f"/regions/{rid}/affordable-housing").status_code == 404:
        pytest.skip("affordable housing not loaded")
    return int(rid)


def test_overview_keeps_counts_but_not_the_whole_inventory(state_id: int) -> None:
    full = client.get(f"/regions/{state_id}/affordable-housing").json()
    response = client.get(f"/regions/{state_id}/affordable-housing?overview=true")
    small = response.json()
    assert small["stats"] == full["stats"]
    assert len(small["records"]) <= 6
    assert len(response.content) < 10_000
    assert full["overview"] is False and small["overview"] is True


def test_inventory_records_are_cited_and_no_owner_fields_exposed(state_id: int) -> None:
    body = client.get(f"/regions/{state_id}/affordable-housing").json()
    assert all(
        r["release_id"] and r["source_url"] and r["snapshot"] for r in body["records"]
    )
    for r in body["records"]:
        assert not any("owner" in k or "email" in k for k in r["payload"])
    assert any("non-binding" in s for s in body["limitations"])
    assert any("NHPD" in s for s in body["limitations"])


def test_assistance_is_never_allocated_to_zip_codes(state_id: int) -> None:
    rows = client.get("/regions?level=zip&state=NJ&limit=1").json()["items"]
    if not rows:
        pytest.skip("no loaded ZIP geography")
    response = client.get(f"/regions/{rows[0]['region_id']}/affordable-housing")
    assert response.status_code == 404


def test_freshness_includes_ancillary_inventory_snapshot(state_id: int) -> None:
    sources = {s["source_id"]: s for s in client.get("/freshness").json()["sources"]}
    assert sources["hud_assisted"]["period_observed_end"] is not None
    assert sources["hud_lihtc"]["period_observed_end"] == "2020-12-31"
