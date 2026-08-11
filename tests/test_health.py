"""The /health endpoint, including the degradation paths.

These run without Postgres on purpose: the warehouse being down is a state the API must
report, not a state in which it falls over.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.warehouse.db import DatabaseStatus

client = TestClient(app)


def _patch_probe(monkeypatch: pytest.MonkeyPatch, status: DatabaseStatus) -> None:
    monkeypatch.setattr("hip.api.routers.health.probe", lambda: status)


def test_unreachable_warehouse_is_degraded_not_an_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_probe(monkeypatch, DatabaseStatus(connected=False, error="OperationalError"))

    response = client.get("/health")

    # The API is up; its data source is not. Those are different failures.
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"]["connected"] is False
    assert "db-up" in body["detail"]


def test_reachable_but_unmigrated_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_probe(monkeypatch, DatabaseStatus(connected=True, migrated=False))

    body = client.get("/health").json()

    assert body["status"] == "degraded"
    assert body["database"]["connected"] is True
    assert "migrate" in body["detail"]


def test_migrated_but_empty_is_ok_with_a_note(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_probe(
        monkeypatch, DatabaseStatus(connected=True, migrated=True, last_load_at=None)
    )

    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert body["database"]["last_load_at"] is None
    assert "No source release" in body["detail"]


def test_loaded_warehouse_reports_freshness(monkeypatch: pytest.MonkeyPatch) -> None:
    loaded_at = datetime(2026, 8, 10, 12, 0, tzinfo=UTC)
    _patch_probe(
        monkeypatch,
        DatabaseStatus(connected=True, migrated=True, last_load_at=loaded_at),
    )

    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert body["detail"] is None
    assert body["database"]["last_load_at"].startswith("2026-08-10T12:00:00")


def test_health_against_the_real_probe_never_raises() -> None:
    """No Postgres in CI or on a fresh checkout — this must still answer."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}
