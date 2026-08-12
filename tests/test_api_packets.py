"""The packet and report endpoints, served from a computed warehouse."""

from __future__ import annotations

import json

import jsonschema
import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.packets import SCHEMA_PATH
from hip.warehouse.db import probe

client = TestClient(app)

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture(scope="module")
def county_id() -> int:
    body = client.get("/rankings?metric_id=zhvi_sfr&level=county&limit=1").json()
    if not body.get("items"):
        pytest.skip("no analytics; run `hip analyze`")
    region_id: int = body["items"][0]["region_id"]
    return region_id


def test_packet_endpoint_serves_the_published_contract(county_id: int) -> None:
    response = client.get(f"/regions/{county_id}/packet?window=5y")

    assert response.status_code == 200
    body = response.json()
    assert body["packet_version"] == "1.0"
    jsonschema.validate(body, json.loads(SCHEMA_PATH.read_text()))


def test_packet_agrees_with_the_summary_endpoint(county_id: int) -> None:
    """Two views of one warehouse must not disagree about a number."""
    packet = client.get(f"/regions/{county_id}/packet?window=5y").json()
    summary = client.get(f"/regions/{county_id}/summary?window=5y").json()

    headlines = {h["metric_id"]: h for h in summary["headlines"]}
    assert headlines
    for metric in packet["metrics"]:
        headline = headlines[metric["metric_id"]]
        assert metric["end_value"] == headline["end_value"]
        assert metric["pct_change"] == headline["pct_change"]
        assert metric["rank"] == headline["rank"]


def test_packet_is_served_fresh_not_from_data_packets(county_id: int) -> None:
    """The endpoint assembles from Postgres; a file on disk is never consulted.

    Two calls must be identical, and neither may depend on `hip pack` having run.
    """
    first = client.get(f"/regions/{county_id}/packet?window=5y").json()
    second = client.get(f"/regions/{county_id}/packet?window=5y").json()

    assert first == second


def test_unknown_region_is_404_not_an_empty_packet() -> None:
    response = client.get("/regions/999999/packet")

    assert response.status_code == 404
    assert "No region" in response.json()["detail"]


def test_report_endpoint_serves_markdown(county_id: int) -> None:
    response = client.get(f"/regions/{county_id}/report?window=5y")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert response.text.startswith("# ")
    assert "## Sources" in response.text
    assert "## Caveats" in response.text


def test_report_for_an_unknown_region_is_404(county_id: int) -> None:
    response = client.get("/regions/999999/report")

    assert response.status_code == 404


def test_an_unsupported_window_is_rejected_before_the_query(county_id: int) -> None:
    """The window vocabulary is shared with `hip analyze`, so a typo is a 422."""
    response = client.get(f"/regions/{county_id}/packet?window=7y")

    assert response.status_code == 422
