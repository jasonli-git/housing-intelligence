"""The explanation endpoint: interpretation, served as interpretation.

The contract these tests defend is not "the text is good" — no test can assert that of
generated prose. It is that a consumer cannot mistake the text for a measurement, and
that the endpoint stays read-only. Both are structural, so both are testable.

The row is written directly rather than by generating one: these tests must run in CI
and on a laptop without 5GB of model weights resident, and what is under test here is
the serving path, not the model.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from hip.api.main import app
from hip.packets import build_packet, packet_hash
from hip.warehouse.db import get_engine, probe
from hip.warehouse.models import RegionExplanation

client = TestClient(app)

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")

WINDOW = "5y"
BODY = "Home values rose faster than incomes over the window."


@pytest.fixture(scope="module")
def county_id() -> int:
    body = client.get("/rankings?metric_id=zhvi_sfr&level=county&limit=1").json()
    if not body.get("items"):
        pytest.skip("no analytics; run `hip analyze`")
    region_id: int = body["items"][0]["region_id"]
    return region_id


def _store(region_id: int, packet_sha256: str) -> None:
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(
                RegionExplanation.region_id == region_id,
                RegionExplanation.window == WINDOW,
            )
        )
        session.add(
            RegionExplanation(
                region_id=region_id,
                window=WINDOW,
                model_id="gemma-4-e4b-q4",
                model_label="Gemma 4 E4B",
                runtime="ollama",
                body=BODY,
                packet_sha256=packet_sha256,
            )
        )
        session.commit()


@pytest.fixture(autouse=True)
def preserve_real_explanations(county_id: int) -> Iterator[None]:
    """Snapshot and restore any real explanation for the county under test.

    These tests write and delete rows in a developer's actual warehouse, and one of
    them deletes deliberately to exercise the 404 path. Without this, running the suite
    silently destroys generated explanations — it removed Atlantic County's on
    2026-08-14, which only surfaced because a count came back 20 instead of 21.

    Autouse so a test added later cannot forget it. Restores the exact row, including
    `generated_at`, so the warehouse is byte-identical afterwards.
    """
    with Session(get_engine()) as session:
        saved = [
            {
                "region_id": row.region_id,
                "window": row.window,
                "model_id": row.model_id,
                "model_label": row.model_label,
                "runtime": row.runtime,
                "body": row.body,
                "packet_sha256": row.packet_sha256,
                "generated_at": row.generated_at,
            }
            for row in session.execute(
                select(RegionExplanation).where(RegionExplanation.region_id == county_id)
            ).scalars()
        ]
    yield
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(RegionExplanation.region_id == county_id)
        )
        for row in saved:
            session.add(RegionExplanation(**row))
        session.commit()


@pytest.fixture
def current_explanation(county_id: int) -> Iterator[int]:
    """An explanation pinned to the packet as it currently stands."""
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store(county_id, digest)
    yield county_id


def test_absent_explanation_is_a_404_not_an_error(county_id: int) -> None:
    """The ordinary state of a fresh warehouse: no AI layer, platform still works."""
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(RegionExplanation.region_id == county_id)
        )
        session.commit()

    response = client.get(f"/regions/{county_id}/explanation?window={WINDOW}")
    assert response.status_code == 404
    assert "hip explain" in response.json()["detail"]


def test_response_labels_itself_as_interpretation(current_explanation: int) -> None:
    """The field a consumer would have to deliberately ignore to misrepresent this."""
    body = client.get(
        f"/regions/{current_explanation}/explanation?window={WINDOW}"
    ).json()

    assert body["kind"] == "interpretation"
    assert body["body"] == BODY
    assert "not a measurement" in body["disclaimer"]


def test_response_names_the_model_that_wrote_it(current_explanation: int) -> None:
    body = client.get(
        f"/regions/{current_explanation}/explanation?window={WINDOW}"
    ).json()

    assert body["model_id"] == "gemma-4-e4b-q4"
    assert body["model_label"] == "Gemma 4 E4B"
    assert body["runtime"] == "ollama"


def test_a_current_explanation_is_not_stale(current_explanation: int) -> None:
    body = client.get(
        f"/regions/{current_explanation}/explanation?window={WINDOW}"
    ).json()
    assert body["stale"] is False


def test_an_explanation_written_from_other_numbers_reports_stale(
    county_id: int,
) -> None:
    """Prose about revised figures still reads as authoritative — hence the flag."""
    _store(county_id, "0" * 64)
    body = client.get(f"/regions/{county_id}/explanation?window={WINDOW}").json()
    assert body["stale"] is True


def test_the_endpoint_does_not_write(current_explanation: int) -> None:
    """Read-only by construction (ARCHITECTURE #6): a GET generates nothing."""
    with Session(get_engine()) as session:
        before = session.execute(select(RegionExplanation.body)).scalars().all()

    client.get(f"/regions/{current_explanation}/explanation?window={WINDOW}")
    client.get(f"/regions/{current_explanation}/explanation?window=since_2019")

    with Session(get_engine()) as session:
        after = session.execute(select(RegionExplanation.body)).scalars().all()
    assert before == after


def test_explanations_are_scoped_per_window(current_explanation: int) -> None:
    """A 5y narrative and a since-2019 one describe different things."""
    response = client.get(f"/regions/{current_explanation}/explanation?window=since_2019")
    assert response.status_code == 404
