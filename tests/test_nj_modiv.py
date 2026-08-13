"""The NJ MOD-IV parcel adapter and the municipality aggregates it feeds.

The adapter half runs anywhere: it drives `_fetch_bytes` against a stubbed transport,
so 3.48M parcels are never downloaded to prove the paging works. The warehouse half
checks what actually landed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.sources.base import ReleaseRef, SourceError
from hip.sources.nj_modiv import WINDOW, ModivAdapter
from hip.warehouse.db import get_engine, probe

REF = ReleaseRef(
    source_id="nj_modiv",
    layer="statewide",
    vintage="current",
    url="https://example.invalid/query",
)


def _feature(objectid: int) -> dict[str, Any]:
    return {
        "attributes": {
            "OBJECTID": objectid,
            "PAMS_PIN": f"2001_1_{objectid}",
            "CD_CODE": "2001",
            "NET_VALUE": 231600,
            "PROP_CLASS": "2",
        }
    }


def _adapter_with(handler: Any) -> ModivAdapter:
    """A ModivAdapter whose HTTP client is backed by a stub transport."""

    class StubbedAdapter(ModivAdapter):
        def _client(self) -> httpx.Client:
            return httpx.Client(transport=httpx.MockTransport(handler))

    return StubbedAdapter()


def test_refs_describe_one_statewide_release() -> None:
    """One release, because the publisher offers one statewide layer.

    Inventing per-county releases would claim a provenance boundary the source does
    not have.
    """
    refs = ModivAdapter().refs()

    assert len(refs) == 1
    assert refs[0].layer == "statewide"
    assert refs[0].vintage == "current"


def test_filename_is_named_by_the_adapter_not_the_url() -> None:
    """The URL ends in `/query`; a file called `query` would tell a reader nothing."""
    assert ModivAdapter.filename(REF) == "parcels_modiv_nj.ndjson"


def test_the_window_size_matches_the_service_page_cap() -> None:
    """A window wider than maxRecordCount would silently truncate every page."""
    assert WINDOW == 2000


def test_an_arcgis_error_body_is_a_failure_not_data(tmp_path: Path) -> None:
    """ArcGIS answers a rejected query with HTTP 200 and an `error` object.

    Trusting the status code would cache an error document as though it were parcels —
    the same trap ACS set at Milestone 3, where a keyless request returned 200 and an
    HTML "Missing Key" page.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": {"code": 400, "message": "nope"}})

    adapter = _adapter_with(handler)

    with pytest.raises(SourceError, match="failed after"):
        adapter._fetch_bytes(REF, tmp_path / "out.ndjson")


def test_a_transient_page_failure_is_retried(tmp_path: Path) -> None:
    """A blip 1,700 requests in must not discard the whole fetch."""
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if "orderByFields" in request.url.params:
            return httpx.Response(200, json={"features": [_feature(1)]})
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(503, text="upstream hiccup")
        return httpx.Response(200, json={"features": [_feature(1)]})

    destination = tmp_path / "out.ndjson"
    _adapter_with(handler)._fetch_bytes(REF, destination)

    assert attempts["n"] == 2
    assert len(destination.read_text().strip().splitlines()) == 1


def test_every_row_is_written_as_one_json_line(tmp_path: Path) -> None:
    """NDJSON, so neither this stage nor landing holds 3.48M rows in memory."""

    def handler(request: httpx.Request) -> httpx.Response:
        if "orderByFields" in request.url.params:
            return httpx.Response(200, json={"features": [_feature(3)]})
        return httpx.Response(
            200, json={"features": [_feature(1), _feature(2), _feature(3)]}
        )

    destination = tmp_path / "out.ndjson"
    _adapter_with(handler)._fetch_bytes(REF, destination)

    lines = destination.read_text().strip().splitlines()
    assert len(lines) == 3
    assert json.loads(lines[0])["CD_CODE"] == "2001"


def test_a_capped_page_splits_instead_of_losing_rows(tmp_path: Path) -> None:
    """`exceededTransferLimit` must halve the window, never drop the overflow.

    Defensive: OBJECTID is dense today so a full window fits one page. If the layer
    were rebuilt with gaps, silently keeping 2000 of 3000 rows would be far worse than
    two extra requests.
    """
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "orderByFields" in request.url.params:
            return httpx.Response(200, json={"features": [_feature(1)]})
        where = request.url.params["where"]
        seen.append(where)
        # Cap only the first, full-width window.
        capped = where == f"OBJECTID>=1 AND OBJECTID<{1 + WINDOW}"
        return httpx.Response(
            200,
            json={"features": [_feature(1)], "exceededTransferLimit": capped},
        )

    _adapter_with(handler)._fetch_bytes(REF, tmp_path / "out.ndjson")

    assert len(seen) == 3, "one capped window plus its two halves"


def test_an_empty_result_is_an_error_not_an_empty_file(tmp_path: Path) -> None:
    """A zero-row file would land, stage, and quietly empty every MOD-IV metric."""

    def handler(request: httpx.Request) -> httpx.Response:
        if "orderByFields" in request.url.params:
            return httpx.Response(200, json={"features": [_feature(1)]})
        return httpx.Response(200, json={"features": []})

    with pytest.raises(SourceError, match="no rows"):
        _adapter_with(handler)._fetch_bytes(REF, tmp_path / "out.ndjson")


# --- against a real warehouse -----------------------------------------------------

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")

MODIV_METRICS = (
    "modiv_median_assessed_value",
    "modiv_residential_parcels",
    "modiv_median_year_built",
    "modiv_median_lot_acres",
    "modiv_vacant_land_share",
    "modiv_multifamily_share",
)


@pytest.fixture(scope="module")
def session() -> Session:
    return Session(get_engine())


@pytest.fixture(scope="module")
def modiv_loaded(session: Session) -> None:
    loaded = session.execute(
        text(
            "SELECT count(*) FROM fact_metric_observation "
            "WHERE metric_id = 'modiv_residential_parcels'"
        )
    ).scalar_one()
    if not loaded:
        pytest.skip("MOD-IV not loaded; run `hip acquire -s nj_modiv` and the pipeline")


@warehouse
def test_every_modiv_metric_reached_the_warehouse(
    session: Session, modiv_loaded: None
) -> None:
    present = set(
        session.execute(
            text(
                "SELECT DISTINCT metric_id FROM fact_metric_observation "
                "WHERE metric_id LIKE 'modiv_%'"
            )
        ).scalars()
    )

    assert present == set(MODIV_METRICS)


@warehouse
def test_modiv_resolves_municipalities_by_code_not_by_guessing(
    session: Session, modiv_loaded: None
) -> None:
    """The whole point of MOD-IV: an exact municipal match where Zillow could not.

    Zillow reaches 403 of 564 municipalities because it publishes no FIPS and its
    names carry no legal form. MOD-IV carries both, so it should clear that ceiling
    decisively — and every row must be labelled `nj_cd_code`, never `name_county`.
    """
    rows = (
        session.execute(
            text(
                """
            SELECT count(DISTINCT f.region_id) AS regions,
                   count(DISTINCT f.match_method) AS methods,
                   min(f.match_method) AS method
            FROM fact_metric_observation f
            WHERE f.metric_id = 'modiv_residential_parcels'
            """
            )
        )
        .mappings()
        .one()
    )

    assert rows["methods"] == 1
    assert rows["method"] == "nj_cd_code"
    assert rows["regions"] > 403, "must beat Zillow's name-matching ceiling"


@warehouse
def test_boonton_and_its_township_stay_separate(
    session: Session, modiv_loaded: None
) -> None:
    """The collision that broke Zillow's match at Milestone 2, checked directly.

    Boonton town and Boonton township are different places with different housing.
    MOD-IV's legal form is what keeps them apart, so they must hold different parcel
    counts rather than one merged figure.
    """
    values = session.execute(
        text(
            """
            SELECT r.geoid, f.value
            FROM fact_metric_observation f
            JOIN regions r ON r.region_id = f.region_id
            WHERE f.metric_id = 'modiv_residential_parcels'
              AND r.geoid IN ('3402706610', '3402706640')
            ORDER BY r.geoid
            """
        )
    ).all()

    assert len(values) == 2, "both Boontons must be present"
    assert values[0][1] != values[1][1]


@warehouse
def test_snapshot_metrics_are_ranked_by_value(
    session: Session, modiv_loaded: None
) -> None:
    """MOD-IV has one vintage, so a change ranking cannot exist for it.

    Without `basis='value'` these metrics would load correctly and then be invisible
    to every ranked view — the failure migration 0006 exists to prevent.
    """
    by_basis = dict(
        session.execute(
            text(
                """
                SELECT basis, count(*) FROM region_rankings
                WHERE metric_id = 'modiv_median_assessed_value'
                GROUP BY basis
                """
            )
        ).all()
    )

    assert by_basis.get("value", 0) > 0
    assert "change" not in by_basis
