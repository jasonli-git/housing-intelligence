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
from sqlalchemy import delete, select, text
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
                audience="analyst",
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
    `generated_at`, so the warehouse is byte-identical afterwards — every column the
    table has, read from the model, so a column added later is restored too. A
    hand-written list of columns missed `audience` when migration 0019 added it, and
    the restore failed after the test had already deleted Atlantic County's reading.
    """
    columns = [column.key for column in RegionExplanation.__table__.columns]
    with Session(get_engine()) as session:
        saved = [
            {column: getattr(row, column) for column in columns}
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


# --- two readings per region (Milestone 30) ------------------------------------------

SECTIONS = [
    {"id": "bottom_line", "heading": "The bottom line", "start": 16, "end": 33},
]


def _store_both(
    region_id: int, analyst_sha256: str, consumer_sha256: str | None = None
) -> None:
    """A region's analyst and consumer readings, as `hip explain` writes them."""
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
                audience="analyst",
                model_id="gemini-3.7-flash-low",
                model_label="Gemini 3.7 Flash (low thinking)",
                runtime="gemini",
                rank=0,
                body=BODY,
                packet_sha256=analyst_sha256,
            )
        )
        session.add(
            RegionExplanation(
                region_id=region_id,
                window=WINDOW,
                audience="consumer",
                model_id="deepseek-flash-nothink",
                model_label="DeepSeek V4.1 Flash (thinking off)",
                runtime="deepseek",
                rank=0,
                body="The bottom line\nPrices rose fast.",
                sections=SECTIONS,
                packet_sha256=consumer_sha256 or analyst_sha256,
            )
        )
        session.commit()


@pytest.fixture
def both_readings(county_id: int) -> Iterator[int]:
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store_both(county_id, digest)
    yield county_id


def test_a_region_carries_an_analyst_and_a_consumer_reading(both_readings: int) -> None:
    """Keyed on the audience since migration 0019: writing the consumer reading must not
    erase the analyst one, which the old per-model key would not have prevented either
    way — and the analyst reading leads, as the singular endpoint always has."""
    body = client.get(f"/regions/{both_readings}/explanations?window={WINDOW}").json()
    assert [e["audience"] for e in body["explanations"]] == ["analyst", "consumer"]
    assert [e["model_id"] for e in body["explanations"]] == [
        "gemini-3.7-flash-low",
        "deepseek-flash-nothink",
    ]


def test_the_consumer_reading_carries_its_sections(both_readings: int) -> None:
    body = client.get(f"/regions/{both_readings}/explanations?window={WINDOW}").json()
    analyst, consumer = body["explanations"]
    assert analyst["sections"] is None
    assert consumer["sections"] == SECTIONS
    section = consumer["sections"][0]
    assert consumer["body"][section["start"] : section["end"]] == "Prices rose fast."


def test_the_singular_endpoint_keeps_its_shape_and_serves_the_analyst_reading(
    both_readings: int,
) -> None:
    """`/explanation` is a published contract with an artifact tree behind it: one
    object, and the analyst reading whichever row a scan would reach first."""
    body = client.get(f"/regions/{both_readings}/explanation?window={WINDOW}").json()
    assert isinstance(body, dict)
    assert body["audience"] == "analyst"
    assert body["model_id"] == "gemini-3.7-flash-low"
    assert body["kind"] == "interpretation"
    assert "explanations" not in body


def test_one_reading_can_be_stale_while_the_other_is_current(county_id: int) -> None:
    """Generated independently, so collapsing staleness to one flag per region would
    misreport both."""
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store_both(county_id, digest, consumer_sha256="0" * 64)

    body = client.get(f"/regions/{county_id}/explanations?window={WINDOW}").json()
    by_audience = {e["audience"]: e["stale"] for e in body["explanations"]}
    assert by_audience == {"analyst": False, "consumer": True}


def test_a_consumer_reading_alone_is_no_analyst_reading(county_id: int) -> None:
    """The singular endpoint serves the analyst reading or nothing — never the consumer
    reading under the analyst contract."""
    with Session(get_engine()) as session:
        digest = packet_hash(build_packet(session, county_id, WINDOW))
    _store_both(county_id, digest)
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(
                RegionExplanation.region_id == county_id,
                RegionExplanation.audience == "analyst",
            )
        )
        session.commit()
    assert (
        client.get(f"/regions/{county_id}/explanation?window={WINDOW}").status_code == 404
    )
    plural = client.get(f"/regions/{county_id}/explanations?window={WINDOW}").json()
    assert [e["audience"] for e in plural["explanations"]] == ["consumer"]


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
                audience="analyst",
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


# --- retiring models that leave a list (Milestone 26, per audience since 30) ---------


def test_prune_removes_readings_from_models_off_their_audience_list(
    both_readings: int,
) -> None:
    """A model that leaves an audience's list keeps its rows until something deletes
    them. Kept per audience: a model on the analyst list does not keep a consumer
    reading it wrote, and the prune is scoped to the run's window."""
    from hip.eval.explain import prune

    with Session(get_engine()) as session:
        session.add(
            RegionExplanation(
                region_id=both_readings,
                window="since_2019",
                audience="consumer",
                model_id="deepseek-flash-nothink",
                model_label="DeepSeek",
                runtime="deepseek",
                rank=0,
                body="A reading for another window.",
                packet_sha256="0" * 64,
            )
        )
        session.commit()
        removed = prune(
            session,
            [both_readings],
            WINDOW,
            {
                "analyst": {"gemini-3.7-flash-low", "deepseek-flash-nothink"},
                "consumer": {"gemini-3.7-flash-low"},
            },
        )
        session.commit()

    assert removed == {"deepseek-flash-nothink": 1}
    kept = client.get(f"/regions/{both_readings}/explanations?window={WINDOW}").json()
    assert [e["audience"] for e in kept["explanations"]] == ["analyst"]
    other = client.get(f"/regions/{both_readings}/explanations?window=since_2019").json()
    assert [e["audience"] for e in other["explanations"]] == ["consumer"]


def test_prune_for_one_audience_preserves_the_other(both_readings: int) -> None:
    """A consumer-only explain run must not retire the analyst's reading."""
    from hip.eval.explain import prune

    with Session(get_engine()) as session:
        removed = prune(
            session,
            [both_readings],
            WINDOW,
            {"consumer": {"gemini-3.7-flash-low"}},
        )
        session.commit()

    assert removed == {"deepseek-flash-nothink": 1}
    kept = client.get(f"/regions/{both_readings}/explanations?window={WINDOW}").json()
    assert [e["audience"] for e in kept["explanations"]] == ["analyst"]


def test_prune_refuses_to_keep_nothing(county_id: int) -> None:
    """An empty keep-set would delete every reading in scope."""
    from hip.eval.explain import prune

    with Session(get_engine()) as session, pytest.raises(ValueError):
        prune(session, [county_id], WINDOW, {"analyst": set()})


def test_a_row_without_a_binding_stores_sql_null(county_id: int) -> None:
    """Not the JSON value `null`, which `IS NULL` does not match. Restoring pre-binding
    rows wrote JSON nulls until the column set `none_as_null`."""
    with Session(get_engine()) as session:
        session.execute(
            delete(RegionExplanation).where(RegionExplanation.region_id == county_id)
        )
        session.add(
            RegionExplanation(
                region_id=county_id,
                window=WINDOW,
                audience="analyst",
                model_id="gemma-4-e4b-q4",
                model_label="Gemma 4 E4B",
                runtime="ollama",
                rank=0,
                body=BODY,
                packet_sha256="0" * 64,
                binding=None,
            )
        )
        session.commit()
        is_null = session.execute(
            text(
                "SELECT binding IS NULL FROM region_explanations "
                "WHERE region_id = :r AND model_id = 'gemma-4-e4b-q4'"
            ),
            {"r": county_id},
        ).scalar_one()
    assert is_null
