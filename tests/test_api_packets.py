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
    assert body["packet_version"] == "1.4"
    jsonschema.validate(body, json.loads(SCHEMA_PATH.read_text()))


def test_every_release_a_figure_came_from_is_listed(county_id: int) -> None:
    """Packet 1.2: both ends of every change window cite a release `sources[]` names.

    Until then only the release behind `end_value` was carried, and the start of a
    window very often comes from an older one — ACS 2019 against 2023 — which the
    packet never listed. A citation cannot point at a release the packet omits.
    """
    packet = client.get(f"/regions/{county_id}/packet?window=5y").json()
    listed = {rid for source in packet["sources"] for rid in source["release_ids"]}
    starts = {m["start_release_id"] for m in packet["metrics"]}
    ends = {m["release_id"] for m in packet["metrics"]}

    assert None not in starts
    assert starts <= listed and ends <= listed
    # Without a window spanning two releases this would prove nothing.
    assert any(m["start_release_id"] != m["release_id"] for m in packet["metrics"])


def test_packet_levels_agree_with_the_summary_endpoint(county_id: int) -> None:
    """Snapshot metrics must read the same in both views."""
    packet = client.get(f"/regions/{county_id}/packet?window=5y").json()
    summary = client.get(f"/regions/{county_id}/summary?window=5y").json()

    levels = {lv["metric_id"]: lv for lv in summary["levels"]}
    assert levels
    for level in packet["levels"]:
        assert level["value"] == levels[level["metric_id"]]["value"]
        assert level["rank"] == levels[level["metric_id"]]["rank"]


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


def test_every_figure_says_what_kind_it_is_and_what_it_may_be_used_for(
    county_id: int,
) -> None:
    """Packet 1.4 (Milestone 31): a kind and a licence on every figure, a licence class
    on every source, and the notices the sources' terms require."""
    packet = client.get(f"/regions/{county_id}/packet?window=5y").json()
    for entry in packet["metrics"] + packet["levels"]:
        assert entry["record_type"], entry["metric_id"]
        assert entry["licence_class"], entry["metric_id"]
    by_id = {e["metric_id"]: e for e in packet["levels"]}
    if "price_to_income" in by_id:
        assert by_id["price_to_income"]["licence_class"] == "non_commercial"
    assert all(source["licence_class"] for source in packet["sources"])
    census = [s for s in packet["sources"] if s["source_id"] == "census_acs"]
    assert census and "not endorsed or certified" in census[0]["notices"][0]


def test_the_kind_and_licence_do_not_move_the_content_hash(county_id: int) -> None:
    """They say what a figure is, not what it says: a reading written before 1.4 must
    stay current, re-cited for free, rather than be paid for again."""
    from hip.packets import Packet, packet_content_hash

    packet = Packet.model_validate(
        client.get(f"/regions/{county_id}/packet?window=5y").json()
    )
    stripped = packet.model_copy(
        update={
            "metrics": [
                m.model_copy(
                    update={
                        "record_type": None,
                        "licence_class": None,
                        "originator": None,
                    }
                )
                for m in packet.metrics
            ],
            "levels": [
                v.model_copy(
                    update={
                        "record_type": None,
                        "licence_class": None,
                        "originator": None,
                    }
                )
                for v in packet.levels
            ],
        }
    )
    assert packet_content_hash(stripped) == packet_content_hash(packet)
