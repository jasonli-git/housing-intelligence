"""Rankings, comparisons, and summaries against a computed warehouse."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import probe

client = TestClient(app)

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture(scope="module")
def analyzed() -> None:
    if not client.get("/rankings?metric_id=zhvi_sfr&level=county").json().get("items"):
        pytest.skip("no analytics; run `hip analyze`")


def test_rankings_are_dense_and_bounded(analyzed: None) -> None:
    body = client.get("/rankings?metric_id=zhvi_sfr&level=county&window=5y").json()

    items = body["items"]
    assert items
    assert items[0]["rank"] == 1
    assert all(1 <= i["rank"] <= i["of"] for i in items)
    assert all(0 <= i["percentile"] <= 100 for i in items)
    # New Jersey has 21 counties, so a county ranking is over 21.
    assert items[0]["of"] == 21


def test_rankings_follow_metric_direction(analyzed: None) -> None:
    """Rank 1 must be the good end, and 'good' is the metric's own definition."""
    body = client.get(
        "/rankings?metric_id=price_to_income&level=county&window=5y&limit=21"
    ).json()

    assert body["direction"] == "lower_is_better"
    changes = [i["pct_change"] for i in body["items"]]
    assert changes == sorted(changes), "lower_is_better must rank smallest rise first"


def test_change_windows_are_labelled_honestly(analyzed: None) -> None:
    """An ACS-derived window must span the years its label claims.

    Anchoring on period_start once labelled a 2019-vs-2023 vintage comparison as
    '2015 to 2019', which understated the real separation.
    """
    item = client.get(
        "/rankings?metric_id=price_to_income&level=county&window=5y&limit=1"
    ).json()["items"][0]

    span_days = (
        __import__("datetime").date.fromisoformat(item["window_end"])
        - __import__("datetime").date.fromisoformat(item["window_start"])
    ).days
    assert 1_400 <= span_days <= 2_200, f"5y window spans {span_days} days"


def test_compare_preserves_caller_order(analyzed: None) -> None:
    counties = client.get("/regions?level=county&limit=3").json()["items"]
    ids = [c["region_id"] for c in counties]
    reversed_ids = list(reversed(ids))

    body = client.get(
        "/compare?metric_id=zhvi_sfr&" + "&".join(f"region_ids={i}" for i in reversed_ids)
    ).json()

    assert [r["region_id"] for r in body["regions"]] == reversed_ids
    assert all(r["series"] for r in body["regions"])


def test_summary_carries_headlines_and_caveats(analyzed: None) -> None:
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]

    body = client.get(f"/regions/{mercer['region_id']}/summary?window=5y").json()

    assert body["name"] == "Mercer"
    assert len(body["headlines"]) > 5
    assert any(h["metric_id"].startswith("acs_") for h in body["headlines"])
    # ACS overlap is a real limitation and must travel with the numbers.
    assert any("overlap" in c for c in body["caveats"])


def test_unknown_metric_and_region_are_404(analyzed: None) -> None:
    assert client.get("/rankings?metric_id=not_a_metric").status_code == 404
    assert client.get("/regions/99999999/summary").status_code == 404
