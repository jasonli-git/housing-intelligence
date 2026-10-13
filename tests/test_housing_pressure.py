"""Income cohorts: denominator, uncertainty, provenance and geography guards."""

import math

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.api.routers.housing_pressure import ratio_margin
from hip.warehouse.db import probe
from hip.warehouse.housing_pressure import FIELDS, validate_band


def row() -> dict:
    return {
        "tenure": "renter",
        "band": 0,
        "vintage": "2018-2022",
        "level": "county",
        "geoid": "34035",
        **dict.fromkeys(FIELDS, 10.0),
        "total": 100.0,
    }


def test_cohort_validation_preserves_zero_but_rejects_bad_data() -> None:
    value = row()
    validate_band(value)
    validate_band({**value, **dict.fromkeys(FIELDS, 0.0)})
    for bad in (
        {"total": math.nan},
        {"burdened": 150.0},
        {"band": 5},
        {"vintage": "2019-2023"},
        {"geoid": None},
        {"unknown": -1},
    ):
        with pytest.raises(ValueError):
            validate_band({**value, **bad})


def test_ratio_margin_uses_subset_formula_and_fallback() -> None:
    assert ratio_margin(0, 0, 5, 5) is None
    assert ratio_margin(11, 10, 5, 5) is None
    assert ratio_margin(20, 100, 10, 10) == pytest.approx(math.sqrt(100 - 4) / 100)
    assert ratio_margin(90, 100, 1, 10) == pytest.approx(math.sqrt(1 + 81) / 100)


@pytest.mark.skipif(not probe().migrated, reason="needs loaded warehouse")
def test_loaded_county_town_and_state_keep_exact_basis_and_citations() -> None:
    client = TestClient(app)
    county = client.get("/regions/12/housing-pressure")
    if county.status_code == 404:
        pytest.skip("CHAS income cohorts not loaded")
    for region in (12, 224, 1):
        response = client.get(f"/regions/{region}/housing-pressure")
        assert response.status_code == 200
        data = response.json()
        assert len(data["bands"]) == 10
        assert data["basis"] == ("county_sum" if region == 1 else "direct")
        assert data["areas"] == (21 if region == 1 else 1)
        assert all(len(release["file_sha256"]) == 64 for release in data["releases"])
        for band in data["bands"]:
            if band["share"] is not None:
                assert band["share"] == pytest.approx(band["burdened"] / band["total"])
    zip_region = client.get("/regions?level=zip&limit=1").json()["items"][0]["region_id"]
    assert client.get(f"/regions/{zip_region}/housing-pressure").status_code == 404
