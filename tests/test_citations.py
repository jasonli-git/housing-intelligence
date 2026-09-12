"""Citation binding (Milestone 13), tested without a model or a warehouse.

The binder decides what reaches the site: `hip explain` refuses prose with a figure it
cannot bind, and the evaluation counts the same unbound figures as fabrications. So the
tests below pin both halves of that — which figures are licensed, and which field each
one is attributed to — against a packet shaped like a real county's, with two metrics
sharing a rank, a window whose start comes from an older release, and a caveat that
states a year.
"""

from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace
from typing import Any

import pytest
import typer

from hip.config import load_evaluation
from hip.eval.checks import check_generation, scenario_packet
from hip.eval.explain import UnboundFigures, freshness, generate, rebind
from hip.eval.prompts import render_payload
from hip.eval.types import Generation, Scenario, Telemetry
from hip.packets import bind, packet_content_hash, packet_hash, still_describes
from hip.packets.citations import stated_numbers
from hip.packets.schema import (
    Packet,
    PacketComparisons,
    PacketHighlight,
    PacketLevel,
    PacketMetric,
    PacketRegion,
    PacketSource,
    PacketWindow,
)
from hip.warehouse.models import RegionExplanation

HOME = "Home value index, single-family"
BURDEN = "Renters paying over 30% of income on housing"


@pytest.fixture
def packet() -> Packet:
    def source(source_id: str, name: str, vintage: str, release: int) -> PacketSource:
        return PacketSource(
            source_id=source_id,
            name=name,
            publisher="Publisher",
            license="public domain",
            url="https://example.invalid",
            vintage=vintage,
            fetched_at=datetime(2026, 7, 15, 10, 0, 0),
            release_ids=[release],
        )

    acs = "American Community Survey, 5-year estimates"
    return Packet(
        packet_version="1.2",
        region=PacketRegion(
            region_id=11,
            geoid="34021",
            level="county",
            name="Mercer",
            label="Mercer County, NJ",
            state_code="NJ",
        ),
        window=PacketWindow(label="5y", start=date(2019, 12, 31), end=date(2026, 6, 30)),
        metrics=[
            PacketMetric(
                metric_id="zhvi_sfr",
                label=HOME,
                unit="usd",
                direction="neutral",
                window_start=date(2021, 6, 30),
                window_end=date(2026, 6, 30),
                start_value=310000.0,
                end_value=452500.0,
                pct_change=45.97,
                cagr=7.86,
                rank=4,
                of=21,
                percentile=85.0,
                release_id=7,
                source_id="zillow_zhvi",
                match_method="fips",
                start_release_id=7,
                start_match_method="fips",
            ),
            PacketMetric(
                metric_id="acs_median_hh_income",
                label="Median household income",
                unit="usd",
                direction="higher_is_better",
                window_start=date(2019, 12, 31),
                window_end=date(2023, 12, 31),
                start_value=90000.0,
                end_value=105000.0,
                pct_change=16.67,
                cagr=3.93,
                rank=6,
                of=21,
                percentile=75.0,
                release_id=90,
                source_id="census_acs",
                match_method="fips",
                start_release_id=98,
                start_match_method="fips",
            ),
            PacketMetric(
                metric_id="permits_total_units",
                label="Residential units permitted",
                unit="count",
                direction="neutral",
                window_start=date(2019, 12, 31),
                window_end=date(2024, 12, 31),
                start_value=3112.0,
                end_value=1971.0,
                pct_change=-36.66,
                cagr=-8.73,
                rank=4,
                of=21,
                percentile=85.0,
                release_id=70,
                source_id="census_permits",
                match_method="fips",
                start_release_id=75,
                start_match_method="fips",
            ),
        ],
        levels=[
            PacketLevel(
                metric_id="zhvi_sfr",
                label=HOME,
                unit="usd",
                direction="neutral",
                value=452500.0,
                period_start=date(2026, 6, 1),
                period_end=date(2026, 6, 30),
                rank=4,
                of=21,
                release_id=7,
                source_id="zillow_zhvi",
                match_method="fips",
            ),
            PacketLevel(
                metric_id="acs_renter_cost_burden",
                label=BURDEN,
                unit="ratio",
                direction="lower_is_better",
                value=0.533,
                period_start=date(2019, 1, 1),
                period_end=date(2023, 12, 31),
                rank=12,
                of=21,
                release_id=90,
                source_id="census_acs",
                match_method="fips",
            ),
        ],
        comparisons=PacketComparisons(
            peer_level="county", peer_scope="NJ", peer_count=21
        ),
        highlights=[
            PacketHighlight(
                metric_id="zhvi_sfr",
                label=HOME,
                position="leading",
                rank=4,
                of=21,
                pct_change=45.97,
            )
        ],
        caveats=["Zillow's rent index begins in 2015 and covers far fewer places."],
        sources=[
            source("census_acs", acs, "2019", 98),
            source("census_acs", acs, "2023", 90),
            source("census_permits", "Building Permits Survey", "2019", 75),
            source("census_permits", "Building Permits Survey", "2024", 70),
            source("zillow_zhvi", "Zillow Home Value Index", "current", 7),
        ],
    )


def _only(text: str, packet: Packet) -> Any:
    binding = bind(text, packet)
    assert binding.complete, binding.unbound
    assert len(binding.citations) == 1, binding.citations
    return binding.citations[0]


# --- reading numbers out of text ----------------------------------------------------


def test_every_figure_is_located_in_the_text_it_came_from() -> None:
    """Offsets survive the dates removed around them, or the dashboard would mark the
    wrong characters as a verified figure."""
    text = "Between 2019-12-31 and 2024–2025 permits fell −36.66% to 1,971 ($4.5M)."
    for stated in stated_numbers(text):
        assert text[stated.start : stated.end] == stated.text
    assert [s.value for s in stated_numbers(text)] == [-36.66, 1971.0, 4.5]
    # The comma after a figure is punctuation, not part of it.
    assert [s.text for s in stated_numbers("It hit $612,300, then fell.")] == ["$612,300"]


def test_a_hyphen_after_a_letter_joins_a_word_rather_than_negating() -> None:
    """ "pre-2018" read as minus 2018 was the one unsupported figure `v2` charged to
    Mistral Small 4 — a checker error, not the model's."""
    assert [s.value for s in stated_numbers("no pre-2018 data")] == [2018.0]
    assert [s.value for s in stated_numbers("fell -2.3%")] == [-2.3]


# --- what is licensed ---------------------------------------------------------------


def test_quoted_figures_bind_to_the_fields_that_carry_them(packet: Packet) -> None:
    binding = bind("Home values rose 45.97% to $452,500, from $310,000 in 2021.", packet)
    assert binding.complete
    assert [c.field for c in binding.citations] == [
        "metrics[zhvi_sfr].pct_change",
        "levels[zhvi_sfr].value",
        "metrics[zhvi_sfr].start_value",
        "metrics[zhvi_sfr].window_start",
    ]


def test_an_invented_figure_is_unbound_with_the_nearest_real_one(packet: Packet) -> None:
    binding = bind("Home values reached $612,300.", packet)
    assert [u.text for u in binding.unbound] == ["$612,300"]
    assert binding.unbound[0].nearest is not None


def test_a_small_percentage_is_a_claim_and_is_checked(packet: Packet) -> None:
    """Until Milestone 13 every number under 20 that failed to match exactly was
    skipped as an ordinal, so an invented 3.2% was never examined."""
    binding = bind("Incomes grew 3.2% a year.", packet)
    assert [u.text for u in binding.unbound] == ["3.2%"]


def test_a_small_plain_count_is_still_prose(packet: Packet) -> None:
    assert bind("There are 3 points worth noting.", packet).citations == []
    assert bind("There are 3 points worth noting.", packet).complete


def test_the_size_of_a_decline_is_a_figure_whatever_the_sentence_says(
    packet: Packet,
) -> None:
    """ "fell 36.66%", "improved 36.66%" and a bare "36.66%" all quote -36.66. A
    direction word was required until the first regeneration after `v3` refused
    "improved 42%" for a falling unemployment rate: the direction is a claim, and the
    binding checks figures."""
    for sentence in (
        "Permits fell 36.66% over the window.",
        "Permits improved 36.66% by some reading.",
        "Permits changed by 36.66% over the window.",
    ):
        citation = _only(sentence, packet)
        assert citation.field == "metrics[permits_total_units].pct_change"
        assert citation.packet_value == -36.66


def test_a_share_rounded_to_a_whole_percent_is_a_quotation(packet: Packet) -> None:
    """0.533 is 53.3% to one decimal, which the tolerance cannot reach from 53. Prose
    rounds shares to whole percentages, and the first regeneration after `v3` refused
    correct sentences over it — "47% of renters" for 0.4750."""
    citation = _only("About 53% of renters are cost-burdened.", packet)
    assert citation.field == "levels[acs_renter_cost_burden].value"
    assert citation.packet_value == 0.533


def test_a_year_is_licensed_exactly_or_not_at_all(packet: Packet) -> None:
    """The 0.5% tolerance is ten years wide at 2020, so until Milestone 13 any year
    within a decade of one the packet carried passed."""
    assert [u.text for u in bind("Prices peaked in 2017.", packet).unbound] == ["2017"]


def test_a_year_the_packet_states_in_words_is_quoted_from_them(packet: Packet) -> None:
    citation = _only("Zillow's rent index begins in 2015.", packet)
    assert (citation.kind, citation.field) == ("text", "caveats[0]")


def test_a_figure_in_a_metric_label_is_the_label_quoted(packet: Packet) -> None:
    citation = _only("Renters paying over 30% of income are fewer here.", packet)
    assert citation.field == "levels[acs_renter_cost_burden].label"
    assert citation.label == BURDEN


def test_a_number_inside_a_longer_one_is_not_a_quotation(packet: Packet) -> None:
    """The evaluation checker once accepted any substring, so 201 was "quoted" from the
    caveat's 2015. A gate on published prose cannot license a number that way."""
    payload = render_payload(packet, "markdown")
    binding = bind("It rose by 201 points.", packet, payload=payload)
    assert [u.text for u in binding.unbound] == ["201"]


def test_durations_and_descriptors_are_structure_not_claims(packet: Packet) -> None:
    text = "ACS 5-year estimates for a 4-person household over 10 years, the 5y window."
    binding = bind(text, packet)
    assert binding.citations == [] and binding.unbound == []


def test_numbers_the_question_stated_are_not_claims(packet: Packet) -> None:
    assert bind("There is no data for 1985.", packet, skip={1985.0}).complete


# --- which field a figure is attributed to ------------------------------------------


def test_the_unit_the_writer_used_decides_between_equal_numbers(packet: Packet) -> None:
    """4 is two ranks and, rounded, an annual rate of 3.93%. Written as "4%", it is the
    rate."""
    citation = _only("Incomes grew 4% a year.", packet)
    assert citation.field == "metrics[acs_median_hh_income].cagr"
    assert citation.kind == "annualised"


def test_a_rank_belongs_to_the_metric_its_sentence_is_about(packet: Packet) -> None:
    """Home value and permits both rank 4. The value cited first in the line settles
    which one the rank is."""
    binding = bind("Home value: $452,500 (2026-06-30; rank 4 of 21 counties).", packet)
    assert binding.complete
    rank = next(c for c in binding.citations if c.text == "4")
    assert rank.field in {"metrics[zhvi_sfr].rank", "levels[zhvi_sfr].rank"}
    cohort = next(c for c in binding.citations if c.text == "21")
    assert cohort.field == "comparisons.peer_count"


def test_a_rank_nothing_distinguishes_says_so(packet: Packet) -> None:
    citation = _only("It ranks 4th.", packet)
    assert citation.kind == "rank"
    assert citation.alternatives >= 1


def test_a_change_cites_both_ends_of_its_window(packet: Packet) -> None:
    """Packet 1.2: the start of a window often comes from an older release, and a
    citation has to name it."""
    binding = bind("Incomes rose 16.67% between the two surveys.", packet)
    citation = binding.citations[0]
    assert citation.release_ids == [98, 90]
    assert citation.period_start == date(2019, 12, 31)
    assert citation.period_end == date(2023, 12, 31)
    assert {r.vintage for r in binding.releases} == {"2019", "2023"}


def test_a_start_value_cites_the_release_it_was_read_from(packet: Packet) -> None:
    citation = _only("Median income started at $90,000.", packet)
    assert citation.field == "metrics[acs_median_hh_income].start_value"
    assert citation.release_ids == [98]


# --- the content hash ----------------------------------------------------------------


def test_a_re_download_moves_the_packet_hash_but_not_the_content_hash(
    packet: Packet,
) -> None:
    fetched_again = packet.model_copy(deep=True)
    fetched_again.metrics[0].release_id = 8
    fetched_again.levels[0].release_id = 8
    fetched_again.sources[-1].release_ids = [8]
    fetched_again.sources[-1].fetched_at = datetime(2026, 8, 15, 10, 0, 0)

    assert packet_hash(fetched_again) != packet_hash(packet)
    assert packet_content_hash(fetched_again) == packet_content_hash(packet)


def test_a_moved_figure_moves_the_content_hash(packet: Packet) -> None:
    revised = packet.model_copy(deep=True)
    revised.levels[0].value = 452600.0
    assert packet_content_hash(revised) != packet_content_hash(packet)


def test_staleness_uses_the_content_hash_where_a_row_has_one(packet: Packet) -> None:
    assert still_describes(
        packet, packet_sha256="0" * 64, content_sha256=packet_content_hash(packet)
    )
    # A row from before Milestone 13 has only the full hash to go on.
    assert not still_describes(packet, packet_sha256="0" * 64, content_sha256=None)
    assert still_describes(packet, packet_sha256=packet_hash(packet), content_sha256=None)


# --- the gate in `hip explain` -------------------------------------------------------


class _Runner:
    """Stands in for a runtime: answers every prompt with one fixed text."""

    def __init__(self, answer: str) -> None:
        self.answer = answer

    def generate(self, candidate: Any, scenario: Scenario, *_: Any) -> Generation:
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=candidate.id,
            cohort="gguf",
            mode="deterministic",
            answer=self.answer,
            raw=self.answer,
            telemetry=Telemetry(
                prompt_tokens=100, generation_tokens=40, generation_ms=1.0, total_ms=1.0
            ),
        )


def _generate(answer: str, packet: Packet, monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setattr("hip.eval.explain.build_runner", lambda *_: _Runner(answer))
    return generate(packet, load_evaluation(), "gemma-4-e4b-q4")


def test_prose_with_an_invented_figure_is_refused_not_stored(
    packet: Packet, monkeypatch: pytest.MonkeyPatch
) -> None:
    with pytest.raises(UnboundFigures) as refused:
        _generate("Home values reached $612,300, up 45.97%.", packet, monkeypatch)
    assert [u.text for u in refused.value.binding.unbound] == ["$612,300"]
    # The words around the figure travel with the refusal: a second generation may not
    # reproduce the sentence, so the log of the run that refused it is the evidence.
    assert 'in "…Home values reached $612,300, up 45.97%.…"' in str(refused.value)
    assert "not stored" in str(refused.value)


def test_publishable_prose_carries_its_binding_and_content_hash(
    packet: Packet, monkeypatch: pytest.MonkeyPatch
) -> None:
    explanation = _generate("Home values rose 45.97% to $452,500.", packet, monkeypatch)
    assert explanation.binding.complete
    assert [c.text for c in explanation.binding.citations] == ["45.97%", "$452,500"]
    assert explanation.content_sha256 == packet_content_hash(packet)


def test_a_refusal_is_its_own_outcome_and_a_partial_run(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], packet: Packet
) -> None:
    from hip.eval_cli import PARTIAL, _explain_each, _Outcome, _summarize

    def explain_region(
        session: Any, evaluation: Any, region_id: int, *_: Any, **__: Any
    ) -> Any:
        if region_id == 2:
            raise UnboundFigures(2, "gemini-test", bind("It hit $612,300.", packet))
        return SimpleNamespace(
            model_id="gemini-test",
            region_id=region_id,
            body="Rose.\n",
            binding=SimpleNamespace(citations=[]),
        )

    monkeypatch.setattr("hip.eval.explain.explain_region", explain_region)
    states = {1: "stale", 2: "stale", 3: "rebound"}
    monkeypatch.setattr(
        "hip.eval_cli._stored_state", lambda _s, region_id, *_: states[region_id]
    )
    outcomes = {"gemini-test": _Outcome()}
    _explain_each(
        SimpleNamespace(commit=lambda: None),  # type: ignore[arg-type]
        load_evaluation(),
        outcomes,
        [1, 2, 3],
        window="5y",
        payload_format="markdown",
        force=False,
    )

    outcome = outcomes["gemini-test"]
    assert (outcome.written, outcome.refused, outcome.rebound, outcome.failed) == (
        1,
        1,
        1,
        0,
    )
    assert _summarize(outcomes) == PARTIAL
    printed = capsys.readouterr().out
    assert "1 re-bound without regenerating" in printed
    assert "1 refused for figures the packet does not carry" in printed


# --- re-binding stored prose -------------------------------------------------------


def _row(packet: Packet, body: str, **overrides: Any) -> RegionExplanation:
    fields: dict[str, Any] = {
        "region_id": 11,
        "window": "5y",
        "model_id": "gemma-4-e4b-q4",
        "model_label": "Gemma 4 E4B",
        "runtime": "ollama",
        "rank": 0,
        "body": body,
        "packet_sha256": packet_hash(packet),
        "content_sha256": packet_content_hash(packet),
        "binding": bind(body, packet).model_dump(mode="json"),
    }
    fields.update(overrides)
    return RegionExplanation(**fields)


def test_what_a_stored_explanation_needs(packet: Packet) -> None:
    body = "Home values rose 45.97%."
    assert freshness(_row(packet, body), packet) == "current"
    # Written before binding, from these exact bytes: bound for free.
    legacy = _row(packet, body, binding=None, content_sha256=None)
    assert freshness(legacy, packet) == "rebind"
    # Only provenance moved since it was written: re-cited, not rewritten.
    assert freshness(_row(packet, body, packet_sha256="0" * 64), packet) == "rebind"
    # A figure moved: only a new generation will do.
    revised = packet.model_copy(deep=True)
    revised.metrics[0].pct_change = 46.5
    assert freshness(_row(packet, body), revised) == "stale"


def test_re_binding_pins_the_row_only_when_every_figure_binds(packet: Packet) -> None:
    legacy = _row(packet, "Home values rose 45.97%.", binding=None, content_sha256=None)
    assert rebind(legacy, packet).complete
    assert legacy.binding is not None
    assert legacy.content_sha256 == packet_content_hash(packet)

    invented = _row(
        packet, "Home values hit $612,300.", binding=None, content_sha256=None
    )
    assert not rebind(invented, packet).complete
    assert invented.binding is None and invented.content_sha256 is None


# --- the evaluation's ground truth ---------------------------------------------------


def _scenario(packet: Packet, payload_format: str, *, keep: bool) -> Scenario:
    return Scenario(
        scenario_id="headline_change",
        region_id=11,
        region_label="Mercer County, NJ",
        window="5y",
        question="Which metric changed most?",
        payload_format=payload_format,  # type: ignore[arg-type]
        payload=render_payload(packet, payload_format),
        payload_tokens=10,
        packet=packet if keep else None,
    )


def test_a_scenario_is_checked_against_the_packet_its_model_was_shown(
    packet: Packet,
) -> None:
    assert scenario_packet(_scenario(packet, "markdown", keep=True)) == packet
    assert scenario_packet(_scenario(packet, "json", keep=False)) == packet
    # Markdown cannot be read back into a packet: before Milestone 13 it kept none.
    assert scenario_packet(_scenario(packet, "markdown", keep=False)) is None


def test_a_run_with_nothing_left_to_check_against_is_refused(packet: Packet) -> None:
    """The alternative is today's warehouse, which is not what its models saw."""
    from hip.eval_cli import _ground_truth

    old = _scenario(packet, "markdown", keep=False)
    with pytest.raises(typer.Exit) as refused:
        _ground_truth("v1", [old])
    assert refused.value.exit_code == 1
    kept = _scenario(packet, "markdown", keep=True)
    assert _ground_truth("v3", [kept]) == {kept.key: packet}


def test_a_check_records_the_field_each_figure_bound_to(packet: Packet) -> None:
    scenario = _scenario(packet, "markdown", keep=True)
    generation = _Runner("Home values rose 45.97%.").generate(
        SimpleNamespace(id="gemma-4-e4b-q4"), scenario
    )
    check = check_generation(generation, scenario, packet)
    assert [(n.field, n.kind) for n in check.numbers] == [
        ("metrics[zhvi_sfr].pct_change", "change")
    ]
