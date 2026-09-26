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


def test_summary_scopes_every_caveat_to_figures_the_region_shows(analyzed: None) -> None:
    """The dashboard sets each caveat beside the figures it qualifies (Milestone 18).

    The scopes are the caveat list again, in its order, each naming the metrics it is
    about — and only metrics this region actually shows.
    """
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]
    body = client.get(f"/regions/{mercer['region_id']}/summary?window=5y").json()

    assert [s["text"] for s in body["caveat_scopes"]] == body["caveats"]
    shown = {h["metric_id"] for h in body["headlines"]} | {
        lv["metric_id"] for lv in body["levels"]
    }
    assert all(set(s["metric_ids"]) <= shown for s in body["caveat_scopes"])
    overlap = next(s for s in body["caveat_scopes"] if "overlap" in s["text"])
    assert overlap["metric_ids"]
    assert all(m.startswith("acs_") for m in overlap["metric_ids"])


def test_unknown_metric_and_region_are_404(analyzed: None) -> None:
    assert client.get("/rankings?metric_id=not_a_metric").status_code == 404
    assert client.get("/regions/99999999/summary").status_code == 404


def test_the_summary_carries_margins_and_rank_ranges_for_survey_figures_only(
    analyzed: None,
) -> None:
    """Milestone 28: margins reach the page through the summary, not the packet."""
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]["region_id"]
    body = client.get(f"/regions/{mercer}/summary?window=5y").json()
    levels = {row["metric_id"]: row for row in body["levels"]}
    changes = {row["metric_id"]: row for row in body["headlines"]}
    if "acs_median_hh_income" not in levels:
        pytest.skip("no ACS income for Mercer")

    income = levels["acs_median_hh_income"]
    assert income["margin_of_error"] > 0
    assert income["rank_best"] <= income["rank"] <= income["rank_worst"]
    assert changes["acs_median_hh_income"]["pct_change_margin"] > 0
    # Zillow publishes no margin, so its rank stays a single place.
    home = levels["zhvi_sfr"]
    assert (home["margin_of_error"], home["rank_best"], home["rank_worst"]) == (
        None,
        None,
        None,
    )


def test_rankings_carry_each_region_s_rank_range(analyzed: None) -> None:
    """Milestone 28: the New Jersey page's county table shows the range a survey rank
    could hold, from the same `/rankings` it already reads."""
    body = client.get(
        "/rankings?metric_id=acs_median_hh_income&level=county&window=5y"
    ).json()
    if not body.get("items"):
        pytest.skip("no ACS income ranking")
    for item in body["items"]:
        assert item["rank_best"] <= item["rank"] <= item["rank_worst"]
    zillow = client.get("/rankings?metric_id=zhvi_sfr&level=county&window=5y").json()
    assert all(item["rank_best"] is None for item in zillow["items"])


def test_every_survey_figure_the_api_serves_carries_its_margin(analyzed: None) -> None:
    """SPEC v1.3 (migration 0018): both ends of a change, a ranked value, each
    observation and each compared point carry their margins, and only a survey's."""
    mercer = client.get("/regions?level=county&q=Mercer").json()["items"][0]["region_id"]
    summary = client.get(f"/regions/{mercer}/summary?window=5y").json()
    changes = {row["metric_id"]: row for row in summary["headlines"]}
    levels = {row["metric_id"]: row for row in summary["levels"]}
    if "acs_median_hh_income" not in changes:
        pytest.skip("no ACS income change for Mercer")

    income = changes["acs_median_hh_income"]
    assert income["start_margin"] > 0 and income["end_margin"] > 0
    # The change ends on the latest observation, so its end margin is the level's.
    assert income["end_margin"] == pytest.approx(
        levels["acs_median_hh_income"]["margin_of_error"]
    )
    assert (changes["zhvi_sfr"]["start_margin"], changes["zhvi_sfr"]["end_margin"]) == (
        None,
        None,
    )

    ranked = client.get(
        "/rankings?metric_id=acs_median_hh_income&level=county&window=5y&limit=50"
    ).json()["items"]
    here = next(item for item in ranked if item["region_id"] == mercer)
    assert here["margin_of_error"] == pytest.approx(income["pct_change_margin"])
    assert here["end_margin"] == pytest.approx(income["end_margin"])
    by_value = client.get(
        "/rankings?metric_id=acs_median_hh_income&level=county&basis=value&limit=50"
    ).json()["items"]
    value = next(item for item in by_value if item["region_id"] == mercer)
    assert value["margin_of_error"] == pytest.approx(
        levels["acs_median_hh_income"]["margin_of_error"]
    )

    observed = client.get(
        f"/regions/{mercer}/metrics?metric_id=acs_median_hh_income&metric_id=zhvi_sfr"
    ).json()["observations"]
    assert all(
        (o["margin_of_error"] is not None) == (o["metric_id"] == "acs_median_hh_income")
        for o in observed
    )
    compared = client.get(
        f"/compare?metric_id=acs_median_hh_income&region_ids={mercer}"
    ).json()["regions"][0]["series"]
    assert all(point["margin_of_error"] > 0 for point in compared)
