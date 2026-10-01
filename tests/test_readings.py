"""The two readings and what each must be to publish (Milestone 30), without a model.

`hip.eval.formats` says what an analyst and a consumer reading look like and what keeps
one from publication; `hip.eval.explain.judge_generation` applies it to a generation;
`hip.eval.costs` prices one at the rate it actually billed at. All of it is
deterministic, so it is tested here against fixed text — what a model would write, not
what one did.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from hip.config import (
    CandidateModel,
    Cohort,
    GenerationConfig,
    OffPeak,
    load_evaluation,
)
from hip.eval.costs import Usage, generation_usd
from hip.eval.explain import (
    ReadingRefused,
    UnboundFigures,
    freshness,
    judge_generation,
    write_reading,
)
from hip.eval.formats import (
    FORMATS,
    MAX_FIGURES,
    QUESTIONS,
    TARGET_FIGURES,
    MalformedReading,
    consumer_problems,
    figures_in,
    shape_consumer,
)
from hip.eval.types import Generation, Telemetry
from hip.packets import (
    Packet,
    bind,
    packet_content_hash,
    packet_hash,
    render_markdown,
)
from hip.packets.citations import BINDING_VERSION
from hip.warehouse.models import RegionExplanation
from tests.test_packet_uncertainty import uncertain_packet

ANSWERS = {
    "what_stands_out": (
        "Home values rose 34.4% to $445,078, while incomes rose 24.2% (± 4.0%)."
    ),
    "before_moving": "These are county figures; a street can differ.",
}


def _reading(answers: dict[str, str] | None = None, style: str = "plain") -> str:
    """A consumer reading as a model might write it: headings in one of three dresses."""
    chosen = {**ANSWERS, **(answers or {})}
    blocks = []
    for question in QUESTIONS:
        heading = {
            "plain": question.heading,
            "markdown": f"## {question.heading}",
            "bold": f"**{question.heading}**",
        }[style]
        blocks.append(f"{heading}\n{chosen[question.id]}")
    return "\n\n".join(blocks)


def _generation(answer: str, *, error: str | None = None) -> Generation:
    return Generation(
        scenario_key="explain-consumer:11:markdown",
        scenario_id="explain-consumer",
        region_id=11,
        model_id="gemini-test",
        cohort="gemini",
        mode="deterministic",
        answer=answer,
        raw=answer,
        telemetry=Telemetry(
            prompt_tokens=100, generation_tokens=40, generation_ms=1.0, total_ms=1.0
        ),
        error=error,
    )


# --- the consumer reading's shape ---------------------------------------------------


@pytest.mark.parametrize("style", ["plain", "markdown", "bold"])
def test_a_consumer_reading_is_shaped_into_its_answers(style: str) -> None:
    body, sections = shape_consumer(_reading(style=style))

    assert [s.id for s in sections] == [q.id for q in QUESTIONS]
    for section in sections:
        assert body[section.start : section.end] == ANSWERS[section.id]
    # The stored body names each question exactly as the site does, whatever the dress.
    assert body.startswith("What stands out here?\nHome values rose")
    assert "## " not in body and "**" not in body


def test_an_answer_on_its_headings_line_and_a_curly_apostrophe_are_understood() -> None:
    text = _reading().replace("What stands out here?\n", "**What stands out here:** ")
    body, sections = shape_consumer(text)
    changing = next(s for s in sections if s.id == "what_stands_out")
    assert body[changing.start : changing.end] == ANSWERS["what_stands_out"]


def test_bullets_and_bold_inside_an_answer_are_flattened() -> None:
    text = _reading({"before_moving": "- Check the **tax bill**.\n- Visit the street."})
    body, sections = shape_consumer(text)
    last = sections[-1]
    assert body[last.start : last.end] == "Check the tax bill. Visit the street."


def test_a_missing_heading_is_no_reading() -> None:
    text = _reading().replace("What should I check before moving?", "Before moving")
    with pytest.raises(MalformedReading, match="What should I check"):
        shape_consumer(text)


def test_an_empty_answer_is_no_reading() -> None:
    with pytest.raises(MalformedReading, match="no answer under"):
        shape_consumer(_reading({"what_stands_out": "   "}))


# --- the consumer reading's rules ---------------------------------------------------


def _problems(answers: dict[str, str], packet: Packet | None = None) -> list[str]:
    packet = packet or uncertain_packet()
    body, sections = shape_consumer(_reading(answers))
    binding = bind(body, packet, payload=render_markdown(packet))
    assert binding.complete, binding.unbound
    return consumer_problems(body, sections, binding, packet)


def test_a_reading_that_keeps_every_rule_has_no_problems() -> None:
    assert _problems({}) == []


def test_a_source_name_is_a_problem() -> None:
    problems = _problems({"before_moving": "Zillow's figures cover the county."})
    assert len(problems) == 1
    assert problems[0].startswith("a source name: 'Zillow' in \"…")


def test_the_packets_own_publishers_are_source_names_too() -> None:
    problems = _problems({"before_moving": "The U.S. Census Bureau measures this."})
    assert any("U.S. Census Bureau" in p for p in problems)


@pytest.mark.parametrize("word", ["median", "Median", "parcels", "cohort", "index"])
def test_jargon_is_a_problem(word: str) -> None:
    problems = _problems({"before_moving": f"The {word} here is a county figure."})
    assert problems and problems[0].startswith("jargon:")


def test_two_measures_of_the_same_thing_are_a_problem() -> None:
    """The pilot's first round set the survey's typical home value beside Zillow's, and
    a reader saw two home values that disagreed (#275). Across the whole reading, since
    its answers sit on one page."""
    packet = uncertain_packet()
    population = next(v for v in packet.levels if v.metric_id == "acs_population")
    estimate = population.model_copy(
        update={
            "metric_id": "pep_population",
            "label": "Population estimate",
            "value": 391200.0,
            "survey": False,
            "margin_of_error": None,
        }
    )
    packet.levels.append(estimate)
    problems = _problems(
        {
            "before_moving": (
                "385,864 people live here, with no sampling error. Another count puts "
                "it at 391,200."
            ),
        },
        packet,
    )
    assert problems == [
        "two measures of the same thing: 'Total population' and 'Population "
        "estimate'; keep the one the reading quotes first"
    ]


@pytest.mark.parametrize(
    "opening", ["Between 2019 and 2024, home values", "In 2024 home values", "2024 saw"]
)
def test_what_stands_out_may_not_open_on_a_date(opening: str) -> None:
    problems = _problems(
        {"what_stands_out": f"{opening} rose. A buyer pays more. County figures."}
    )
    assert problems == [
        "'What stands out here?' opens with a date or a span of years; begin with the "
        "place's name or the measure"
    ]


def test_what_stands_out_keeps_to_housing() -> None:
    """The pilot's second round led with unemployment and population, then guessed at
    what they meant for businesses and community life."""
    problems = _problems(
        {
            "what_stands_out": (
                "Mercer County has 385,864 people, with no sampling error. That is many. "
                "County figures."
            )
        }
    )
    assert problems == [
        "'What stands out here?' quotes 'Total population', which is not a housing "
        "measure"
    ]


def test_population_is_still_allowed_in_other_answers() -> None:
    assert (
        _problems({"before_moving": "385,864 people live here, with no sampling error."})
        == []
    )


def test_more_figures_in_an_answer_than_the_limit_is_a_problem() -> None:
    crowded = (
        "Home values rose 34.4% to $445,078, incomes rose 24.2% (± 4.0%), and 385,864 "
        "people live here, with no sampling error."
    )
    problems = _problems({"before_moving": crowded})
    assert problems == [
        "4 figures under 'What should I check before moving?', where at most "
        f"{MAX_FIGURES} are allowed"
    ]


def test_a_margin_a_range_and_a_quoted_label_do_not_count_as_figures() -> None:
    answer = (
        "Incomes are $100,645, give or take $2,565, between 10th and 12th of 21 "
        "counties; renters pay over 30% of income."
    )
    problems = _problems({"before_moving": answer})
    assert not [p for p in problems if "figures under" in p]


def test_a_figure_stated_twice_counts_twice() -> None:
    """The limit is on what a reader sees, not on how many packet fields are behind it."""
    repeated = (
        "Home values rose 34.4% to $445,078; that 34.4% rise took the typical home to "
        "$445,078."
    )
    assert _problems({"before_moving": repeated}) == [
        "4 figures under 'What should I check before moving?', where at most "
        f"{MAX_FIGURES} are allowed"
    ]


def test_a_range_is_one_figure_however_its_ends_were_bound() -> None:
    packet = uncertain_packet()
    body, sections = shape_consumer(
        _reading(
            {
                "what_stands_out": (
                    "Incomes are $100,645, give or take $2,565, between 10th and 12th "
                    "of 21 counties."
                )
            }
        )
    )
    binding = bind(body, packet, payload=render_markdown(packet))
    changing = next(s for s in sections if s.id == "what_stands_out")
    assert figures_in(body, binding, changing) == 2


# --- judging a generation -------------------------------------------------------------


def _judge(answer: str, audience: str = "consumer") -> Any:
    packet = uncertain_packet()
    return judge_generation(
        packet,
        _generation(answer),
        render_markdown(packet),
        audience=audience,  # type: ignore[arg-type]
    )


def test_a_publishable_consumer_reading_passes_every_gate() -> None:
    body, sections, binding = _judge(_reading())
    assert binding.complete and len(sections) == len(QUESTIONS)
    assert body.count("\n\n") == len(QUESTIONS) - 1


def test_a_consumer_reading_out_of_shape_is_refused() -> None:
    with pytest.raises(ReadingRefused, match="no heading"):
        _judge("Prices rose.")


def test_an_invented_figure_is_refused_before_any_other_rule() -> None:
    with pytest.raises(UnboundFigures):
        _judge(_reading({"what_stands_out": "Home values hit $612,300."}))


def test_a_survey_figure_without_its_margin_is_refused_in_either_format() -> None:
    with pytest.raises(ReadingRefused, match="without its margin"):
        _judge(_reading({"what_stands_out": "Incomes here rose 24.2% in five years."}))
    with pytest.raises(ReadingRefused, match="without its margin"):
        _judge("Median household income rose 24.2% over the window.", "analyst")


def test_the_analyst_reading_is_its_prose_with_no_sections() -> None:
    body, sections, _ = _judge(
        "Household income rose 24.2% (± 4.0%) to $100,645 (± $2,565).\n", "analyst"
    )
    assert body == "Household income rose 24.2% (± 4.0%) to $100,645 (± $2,565)."
    assert sections == []


def test_a_failed_call_is_a_failure_not_a_refusal() -> None:
    packet = uncertain_packet()
    with pytest.raises(RuntimeError, match="HTTP 503") as failed:
        judge_generation(
            packet,
            _generation("", error="HTTP 503"),
            render_markdown(packet),
            audience="analyst",
        )
    assert not isinstance(failed.value, (ReadingRefused, UnboundFigures))


def test_the_prompts_name_every_rule_the_gates_hold_them_to() -> None:
    consumer = FORMATS["consumer"].prompt
    for question in QUESTIONS:
        assert question.heading in consumer
    # Asked for fewer than publication allows: a model overshoots what it is asked for.
    assert f"at most {TARGET_FIGURES} figures" in consumer
    assert TARGET_FIGURES < MAX_FIGURES
    assert "give or take" in consumer
    assert "median" in consumer
    assert "±" in FORMATS["analyst"].prompt


# --- what a generation cost -----------------------------------------------------------

_MODEL = CandidateModel(
    id="m",
    ref="m",
    label="m",
    quantization="hosted",
    input_usd_per_mtok=1.0,
    output_usd_per_mtok=2.0,
)


def _hosted(**fields: Any) -> Cohort:
    return Cohort(
        runner="hosted",
        provider=fields.pop("provider", "gemini"),
        api_key_env="KEY",
        endpoint="https://x",
        models=[_MODEL],
        **fields,
    )


def test_a_flex_call_bills_at_its_tiers_rate() -> None:
    cohort = _hosted(generation_tier="flex", tier_rates={"flex": 0.5})
    at = datetime(2026, 9, 25, 12, tzinfo=UTC)
    full, _ = generation_usd(_MODEL, cohort, 1_000_000, 0, tier="standard", at=at)
    flex, _ = generation_usd(_MODEL, cohort, 1_000_000, 0, tier="flex", at=at)
    assert (full, flex) == (1.0, 0.5)


def test_deepseek_bills_half_outside_its_peak_hours() -> None:
    cohort = _hosted(
        provider="deepseek", off_peak=OffPeak(rate=0.5, peak_utc=[(1, 4), (6, 10)])
    )
    friday_run = datetime(2026, 9, 25, 12, tzinfo=UTC)  # 08:00 in New Jersey
    peak = datetime(2026, 9, 22, 7, tzinfo=UTC)  # a Tuesday
    sunday = datetime(2026, 9, 27, 7, tzinfo=UTC)

    assert generation_usd(_MODEL, cohort, 0, 1_000_000, tier=None, at=friday_run) == (
        1.0,
        True,
    )
    assert generation_usd(_MODEL, cohort, 0, 1_000_000, tier=None, at=peak) == (
        2.0,
        False,
    )
    assert generation_usd(_MODEL, cohort, 0, 1_000_000, tier=None, at=sunday)[1] is True


def test_a_local_model_costs_nothing_rather_than_zero() -> None:
    local = CandidateModel(id="g", ref="g", label="g", quantization="Q4")
    cohort = Cohort(runner="ollama", models=[local])
    assert generation_usd(local, cohort, 100, 100, tier=None, at=datetime.now(UTC)) == (
        None,
        False,
    )


# --- config -------------------------------------------------------------------------


def test_a_tier_the_provider_does_not_offer_is_refused_at_load() -> None:
    with pytest.raises(ValueError, match="not one provider 'deepseek' offers"):
        _hosted(provider="deepseek", generation_tier="flex", tier_rates={"flex": 0.5})


def test_a_tier_without_its_rate_is_refused_at_load() -> None:
    with pytest.raises(ValueError, match="needs its rate"):
        _hosted(generation_tier="flex")


def test_every_audience_needs_its_own_list() -> None:
    with pytest.raises(ValueError, match="consumer"):
        GenerationConfig(preference={"analyst": ["m"]})  # type: ignore[dict-item]


# --- revising a refused reading -------------------------------------------------------


def _scripted(answers: list[str], monkeypatch: pytest.MonkeyPatch) -> list[str | None]:
    """A model that writes `answers` in turn; returns the revision each call was sent."""
    sent: list[str | None] = []

    def run_model(packet: Any, evaluation: Any, model_id: str, **kwargs: Any) -> Any:
        sent.append(kwargs.get("revision"))
        answer = answers[len(sent) - 1]
        usage = Usage(model_id, 3000, 300, "flex", 0.001)
        return _generation(answer), render_markdown(packet), usage

    monkeypatch.setattr("hip.eval.explain.run_model", run_model)
    return sent


def test_a_refused_reading_goes_back_to_its_model_with_the_refusal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jargon = _reading({"before_moving": "Check each parcel's tax bill."})
    sent = _scripted([jargon, _reading()], monkeypatch)

    body, sections, _, usage, earlier = write_reading(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", audience="consumer"
    )

    assert len(sections) == len(QUESTIONS) and "parcel" not in body
    assert sent[0] is None
    revision = sent[1] or ""
    assert "jargon: 'parcel'" in revision
    assert "Check each parcel's tax bill." in revision  # the answer to correct
    assert [u.usd for u in earlier] == [0.001] and usage.usd == 0.001


def test_a_reading_refused_after_its_revisions_carries_what_they_cost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jargon = _reading({"before_moving": "Check each parcel's tax bill."})
    evaluation = load_evaluation()
    sent = _scripted([jargon] * 5, monkeypatch)

    with pytest.raises(ReadingRefused) as refused:
        write_reading(
            uncertain_packet(), evaluation, "gemini-3.7-flash-low", audience="consumer"
        )

    assert len(sent) == evaluation.generation.revisions + 1
    assert len(refused.value.earlier) == evaluation.generation.revisions


def test_an_invented_figure_is_revised_too(monkeypatch: pytest.MonkeyPatch) -> None:
    invented = _reading({"what_stands_out": "Home values hit $612,300."})
    sent = _scripted([invented, _reading()], monkeypatch)
    write_reading(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", audience="consumer"
    )
    assert "$612,300" in (sent[1] or "")


def test_a_failed_call_is_not_revised(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[Any] = []

    def run_model(packet: Any, evaluation: Any, model_id: str, **kwargs: Any) -> Any:
        sent.append(kwargs.get("revision"))
        usage = Usage(model_id, 0, 0, None, None)
        return _generation("", error="HTTP 503"), render_markdown(packet), usage

    monkeypatch.setattr("hip.eval.explain.run_model", run_model)
    with pytest.raises(RuntimeError, match="HTTP 503"):
        write_reading(
            uncertain_packet(),
            load_evaluation(),
            "gemini-3.7-flash-low",
            audience="analyst",
        )
    assert sent == [None]


def test_a_consumer_reading_asking_other_questions_is_stale() -> None:
    """The five-answer readings written before 2026-09-30 are rewritten, not re-cited."""
    packet = uncertain_packet()
    body, sections = shape_consumer(_reading())
    row = RegionExplanation(
        region_id=11,
        window="5y",
        audience="consumer",
        model_id="gemini-3.7-flash-low",
        model_label="Gemini",
        runtime="gemini",
        rank=0,
        body=body,
        packet_sha256=packet_hash(packet),
        content_sha256=packet_content_hash(packet),
        binding={"binding_version": BINDING_VERSION},
        sections=[s.as_json() for s in sections],
    )
    assert freshness(row, packet) == "current"
    row.sections = [{"id": "bottom_line"}, *row.sections]
    assert freshness(row, packet) == "stale"


def test_a_revision_that_never_reaches_the_model_keeps_the_refused_attempts_cost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jargon = _reading({"before_moving": "Check each parcel's tax bill."})
    calls: list[int] = []

    def run_model(packet: Any, evaluation: Any, model_id: str, **kwargs: Any) -> Any:
        calls.append(1)
        if kwargs.get("revision"):
            raise ValueError("packet does not fit the configured context window")
        usage = Usage(model_id, 3000, 300, "flex", 0.001)
        return _generation(jargon), render_markdown(packet), usage

    monkeypatch.setattr("hip.eval.explain.run_model", run_model)
    with pytest.raises(ValueError) as failed:
        write_reading(
            uncertain_packet(),
            load_evaluation(),
            "gemini-3.7-flash-low",
            audience="consumer",
        )
    assert [u.usd for u in failed.value.earlier] == [0.001]  # type: ignore[attr-defined]
