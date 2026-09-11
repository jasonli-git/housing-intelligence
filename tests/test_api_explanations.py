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
from hip.packets import (
    bind,
    build_packet,
    format_value,
    packet_content_hash,
    packet_hash,
    render_markdown,
)
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
                rank=0,
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
                "rank": row.rank,
                "body": row.body,
                "packet_sha256": row.packet_sha256,
                "content_sha256": row.content_sha256,
                "binding": row.binding,
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


# --- multi-model comparison (Milestone 19) ------------------------------------------


def _store_many(
    region_id: int, packet_sha256: str, models: list[tuple[str, str, int]]
) -> None:
    """Several models' readings of one region, each at its preference-list rank."""
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(
                RegionExplanation.region_id == region_id,
                RegionExplanation.window == WINDOW,
            )
        )
        for model_id, runtime, rank in models:
            session.add(
                RegionExplanation(
                    region_id=region_id,
                    window=WINDOW,
                    model_id=model_id,
                    model_label=model_id,
                    runtime=runtime,
                    rank=rank,
                    body=f"{model_id} reading. {BODY}",
                    packet_sha256=packet_sha256,
                )
            )
        session.commit()


@pytest.fixture
def five_models(county_id: int) -> Iterator[int]:
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store_many(
        county_id,
        digest,
        [
            ("gemini-3.7-flash", "gemini", 0),
            ("gemini-3.1-flash-lite", "gemini", 1),
            ("mistral-small-4", "mistral", 2),
            ("deepseek-v4-pro", "deepseek", 3),
            ("gemma-4-e4b-q4", "ollama", 4),
        ],
    )
    yield county_id


def test_several_models_coexist_for_one_region(five_models: int) -> None:
    """The capability the widened primary key exists for. Before migration 0010 storing
    a second model's reading silently erased the first."""
    body = client.get(f"/regions/{five_models}/explanations?window={WINDOW}").json()
    assert len(body["explanations"]) == 5
    assert len({e["model_id"] for e in body["explanations"]}) == 5


def test_explanations_are_returned_in_preference_order(five_models: int) -> None:
    """The order is the information — it is the preference list's own ranking, and the
    dashboard takes the first as its default."""
    body = client.get(f"/regions/{five_models}/explanations?window={WINDOW}").json()
    assert [e["model_id"] for e in body["explanations"]] == [
        "gemini-3.7-flash",
        "gemini-3.1-flash-lite",
        "mistral-small-4",
        "deepseek-v4-pro",
        "gemma-4-e4b-q4",
    ]


def test_the_singular_endpoint_keeps_its_shape_and_returns_the_preferred_model(
    five_models: int,
) -> None:
    """`/explanation` is a published contract with an artifact tree behind it. Migration
    0010 must not turn it into a list, and it must answer with rank 1 rather than
    whichever row the scan reached first."""
    body = client.get(f"/regions/{five_models}/explanation?window={WINDOW}").json()
    assert isinstance(body, dict)
    assert body["model_id"] == "gemini-3.7-flash"
    assert body["kind"] == "interpretation"
    assert "explanations" not in body


def test_every_model_reads_the_same_packet(five_models: int) -> None:
    """The point of serving them together: the numbers underneath are identical, so any
    difference in the prose is the model's own."""
    body = client.get(f"/regions/{five_models}/explanations?window={WINDOW}").json()
    assert all(e["stale"] is False for e in body["explanations"])


def test_one_model_can_be_stale_while_another_is_current(
    county_id: int,
) -> None:
    """Models are generated independently, so collapsing staleness to one flag per
    region would misreport both."""
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store_many(county_id, digest, [("gemini-3.7-flash", "gemini", 0)])
    with Session(get_engine()) as session:
        session.add(
            RegionExplanation(
                region_id=county_id,
                window=WINDOW,
                model_id="gemma-4-e4b-q4",
                model_label="Gemma 4 E4B",
                runtime="ollama",
                rank=4,
                body=BODY,
                packet_sha256="0" * 64,
            )
        )
        session.commit()

    body = client.get(f"/regions/{county_id}/explanations?window={WINDOW}").json()
    by_model = {e["model_id"]: e["stale"] for e in body["explanations"]}
    assert by_model == {"gemini-3.7-flash": False, "gemma-4-e4b-q4": True}


def test_absent_explanations_are_a_404_not_an_empty_list(
    county_id: int,
) -> None:
    """`hip publish` treats a 404 as a skip. An empty body would put a contentless file
    in the artifact tree for every region that has no explanation."""
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(RegionExplanation.region_id == county_id)
        )
        session.commit()
    assert (
        client.get(f"/regions/{county_id}/explanations?window={WINDOW}").status_code
        == 404
    )


# --- citation binding (Milestone 13) ------------------------------------------------


def _store_bound(region_id: int, *, packet_sha256: str | None = None) -> str:
    """A row as `hip explain` now writes one, bound and with both hashes; its body."""
    with Session(get_engine()) as session:
        packet = build_packet(session, region_id, WINDOW)
    level = next(lv for lv in packet.levels if lv.metric_id == "zhvi_sfr")
    body = f"The typical single-family home value is {format_value(level.value, 'usd')}."
    binding = bind(body, packet, payload=render_markdown(packet))
    assert binding.complete and binding.citations
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(RegionExplanation.region_id == region_id)
        )
        session.add(
            RegionExplanation(
                region_id=region_id,
                window=WINDOW,
                model_id="gemma-4-e4b-q4",
                model_label="Gemma 4 E4B",
                runtime="ollama",
                rank=0,
                body=body,
                packet_sha256=packet_sha256 or packet_hash(packet),
                content_sha256=packet_content_hash(packet),
                binding=binding.model_dump(mode="json"),
            )
        )
        session.commit()
    return body


def test_a_bound_explanation_serves_where_each_figure_came_from(county_id: int) -> None:
    body = _store_bound(county_id)
    served = client.get(f"/regions/{county_id}/explanation?window={WINDOW}").json()

    citation = served["binding"]["citations"][0]
    assert body[citation["start"] : citation["end"]] == citation["text"]
    assert citation["field"] == "levels[zhvi_sfr].value"
    assert citation["kind"] == "value"
    # The release it names is described, so a client needs no second request.
    releases = {r["release_id"]: r for r in served["binding"]["releases"]}
    assert citation["release_ids"] and citation["release_ids"][0] in releases
    assert releases[citation["release_ids"][0]]["source_id"] == "zillow_zhvi"
    assert served["binding"]["unbound"] == []


def test_text_written_before_binding_says_it_is_unverified(
    current_explanation: int,
) -> None:
    """Null, not an empty binding: an empty one would claim there was nothing to
    check, where the truth is that nothing was checked."""
    served = client.get(f"/regions/{current_explanation}/explanation?window={WINDOW}")
    assert served.json()["binding"] is None
    plural = client.get(f"/regions/{current_explanation}/explanations?window={WINDOW}")
    assert plural.json()["explanations"][0]["binding"] is None


def test_a_re_download_that_moved_no_figure_is_not_staleness(county_id: int) -> None:
    """The full hash moves when a source is fetched again with different bytes; the
    content hash moves only when a figure does, and staleness is decided on it."""
    _store_bound(county_id, packet_sha256="0" * 64)
    served = client.get(f"/regions/{county_id}/explanation?window={WINDOW}").json()
    assert served["stale"] is False
    plural = client.get(f"/regions/{county_id}/explanations?window={WINDOW}").json()
    assert plural["explanations"][0]["stale"] is False
