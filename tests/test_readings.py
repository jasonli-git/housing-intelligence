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

from hip.config import CandidateModel, Cohort, GenerationConfig, OffPeak
from hip.eval.costs import generation_usd
from hip.eval.explain import ReadingRefused, UnboundFigures, judge_generation
from hip.eval.formats import (
    FORMATS,
    MAX_FIGURES,
    QUESTIONS,
    MalformedReading,
    consumer_problems,
    shape_consumer,
)
from hip.eval.types import Generation, Telemetry
from hip.packets import bind, render_markdown
from tests.test_packet_uncertainty import uncertain_packet

ANSWERS = {
    "bottom_line": "Incomes here rose 24.2% (± 4.0%) in five years.",
    "harder_to_afford": (
        "A home costs 4.26 times a typical income, give or take 0.11, near the middle "
        "of New Jersey's 21 counties."
    ),
    "rent_or_buy": (
        "Half of renters, 50.1% give or take 2.3 points, pay over 30% of income."
    ),
    "whats_changing": "Home values rose 34.4% to $445,078.",
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
def test_a_consumer_reading_is_shaped_into_its_five_answers(style: str) -> None:
    body, sections = shape_consumer(_reading(style=style))

    assert [s.id for s in sections] == [q.id for q in QUESTIONS]
    for section in sections:
        assert body[section.start : section.end] == ANSWERS[section.id]
    # The stored body names each question exactly as the site does, whatever the dress.
    assert body.startswith("The bottom line\nIncomes here rose")
    assert "## " not in body and "**" not in body


def test_an_answer_on_its_headings_line_and_a_curly_apostrophe_are_understood() -> None:
    text = _reading().replace("What's changing?\n", "**What’s changing:** ")
    body, sections = shape_consumer(text)
    changing = next(s for s in sections if s.id == "whats_changing")
    assert body[changing.start : changing.end] == ANSWERS["whats_changing"]


def test_bullets_and_bold_inside_an_answer_are_flattened() -> None:
    text = _reading({"before_moving": "- Check the **tax bill**.\n- Visit the street."})
    body, sections = shape_consumer(text)
    last = sections[-1]
    assert body[last.start : last.end] == "Check the tax bill. Visit the street."


def test_a_missing_heading_is_no_reading() -> None:
    text = _reading().replace("How does renting compare with buying?", "Renting")
    with pytest.raises(MalformedReading, match="How does renting compare"):
        shape_consumer(text)


def test_an_empty_answer_is_no_reading() -> None:
    with pytest.raises(MalformedReading, match="no answer under"):
        shape_consumer(_reading({"whats_changing": "   "}))


# --- the consumer reading's rules ---------------------------------------------------


def _problems(answers: dict[str, str]) -> list[str]:
    packet = uncertain_packet()
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


def test_more_than_two_figures_in_an_answer_is_a_problem() -> None:
    crowded = "Home values rose 34.4% to $445,078, and incomes rose 24.2% (± 4.0%)."
    problems = _problems({"whats_changing": crowded})
    assert problems == [
        f"3 figures under 'What's changing?', where at most {MAX_FIGURES} are allowed"
    ]


def test_a_margin_a_range_and_a_quoted_label_do_not_count_as_figures() -> None:
    answer = (
        "Incomes are $100,645, give or take $2,565, between 10th and 12th of 21 "
        "counties; renters pay over 30% of income."
    )
    problems = _problems({"harder_to_afford": answer})
    assert not [p for p in problems if "figures under" in p]


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
        _judge(_reading({"whats_changing": "Home values hit $612,300."}))


def test_a_survey_figure_without_its_margin_is_refused_in_either_format() -> None:
    with pytest.raises(ReadingRefused, match="without its margin"):
        _judge(_reading({"bottom_line": "Incomes here rose 24.2% in five years."}))
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
    assert f"at most {MAX_FIGURES} figures" in consumer
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
