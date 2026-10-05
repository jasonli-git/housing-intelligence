"""The readings side-by-side (Milestone 30): judged as publication would judge them.

`hip eval readings` is the evidence the consumer reading's model is chosen from, so it
has to show what `hip explain` would do — publish, refuse and why, or fail — and never
store anything. Tested with a stand-in model, since what is under test is the judging
and the report, not a provider.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from hip.config import load_evaluation
from hip.eval.costs import Usage
from hip.eval.formats import QUESTIONS
from hip.eval.sidebyside import Trial, render, trial
from hip.eval.types import Generation, Telemetry
from hip.packets import render_markdown
from tests.test_packet_uncertainty import uncertain_packet
from tests.test_readings import _reading


def _model_writing(answer: str, monkeypatch: pytest.MonkeyPatch) -> None:
    def run_model(packet: Any, evaluation: Any, model_id: str, **_: Any) -> Any:
        generation = Generation(
            scenario_key="k",
            scenario_id="explain",
            region_id=packet.region.region_id,
            model_id=model_id,
            cohort="gemini",
            mode="deterministic",
            answer=answer,
            raw=answer,
            telemetry=Telemetry(
                prompt_tokens=3000,
                generation_tokens=300,
                generation_ms=1.0,
                total_ms=1.0,
                service_tier="flex",
            ),
        )
        usage = Usage(model_id, 3000, 300, "flex", 0.0006)
        return generation, render_markdown(packet), usage

    monkeypatch.setattr("hip.eval.sidebyside.run_model", run_model)


def test_a_publishable_reading_is_shown_as_it_would_publish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _model_writing(_reading(), monkeypatch)
    result = trial(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", "consumer"
    )

    assert result.status == "published" and result.reasons == []
    assert [s.id for s in result.sections] == [q.id for q in QUESTIONS]
    assert max(result.figures) <= 3
    assert (result.tier, result.usd) == ("flex", 0.0006)


def test_a_refused_reading_is_shown_with_the_rule_it_broke(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Four figures, all housing ones, so the figure limit is the only rule broken.
    crowded = (
        "Home values rose 34.4% to $445,078; that 34.4% rise took the typical home to "
        "$445,078."
    )
    _model_writing(_reading({"what_stands_out": crowded}), monkeypatch)
    result = trial(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", "consumer"
    )

    assert result.status == "refused"
    assert result.reasons == [
        "4 figures under 'What stands out here?', where at most 3 are allowed"
    ]
    # Sent back once, as `hip explain` would, and refused again for the same rule.
    assert result.refusals == [result.reasons]
    # Shaped anyway, so the report can still lay it out under its questions.
    assert len(result.sections) == len(QUESTIONS)
    assert result.publishes_at(4) and not result.publishes_at(3)


def test_an_unbound_figure_is_a_refusal_and_an_error_a_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _model_writing("Home values hit $612,300.", monkeypatch)
    invented = trial(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", "analyst"
    )
    assert invented.status == "refused"

    _model_writing("", monkeypatch)
    empty = trial(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", "analyst"
    )
    assert empty.status == "failed"


def test_a_reading_published_after_a_revision_says_so(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    answers = iter([_reading({"what_stands_out": "Check each parcel."}), _reading()])

    def run_model(packet: Any, evaluation: Any, model_id: str, **_: Any) -> Any:
        answer = next(answers)
        generation = Generation(
            scenario_key="k",
            scenario_id="explain",
            region_id=packet.region.region_id,
            model_id=model_id,
            cohort="gemini",
            mode="deterministic",
            answer=answer,
            raw=answer,
            telemetry=Telemetry(
                prompt_tokens=3000, generation_tokens=300, generation_ms=1.0, total_ms=1.0
            ),
        )
        return (
            generation,
            render_markdown(packet),
            Usage(model_id, 3000, 300, None, 0.001),
        )

    monkeypatch.setattr("hip.eval.sidebyside.run_model", run_model)
    result = trial(
        uncertain_packet(), load_evaluation(), "gemini-3.7-flash-low", "consumer"
    )
    assert result.status == "published"
    assert len(result.refusals) == 1 and "parcel" in result.refusals[0][0]
    assert result.usd == 0.002 and result.output_tokens == 600
    report = render([result], ["gemini-3.7-flash-low"], name="t", on=date(2026, 9, 30))
    assert "_Answer 1 refused and sent back for revision:_ jargon: 'parcel'" in report


def _trial(**fields: Any) -> Trial:
    base: dict[str, Any] = {
        "region_id": 11,
        "region_label": "Mercer County, NJ",
        "audience": "consumer",
        "model_id": "gemini-3.7-flash-low",
        "model_label": "Gemini 3.7 Flash (low thinking)",
        "status": "published",
        "reasons": [],
        "body": "Prices rose.",
        "words": 2,
        "seconds": 2.0,
        "usd": 0.001,
    }
    return Trial(**{**base, **fields})


def test_the_report_summarises_each_model_and_lays_out_every_reading() -> None:
    trials = [
        _trial(),
        _trial(
            model_id="deepseek-flash-nothink",
            model_label="DeepSeek V4.1 Flash (thinking off)",
            status="refused",
            reasons=["a survey figure stated without its margin"],
        ),
        _trial(audience="analyst", body="Household income rose."),
    ]
    report = render(
        trials,
        ["gemini-3.7-flash-low", "deepseek-flash-nothink"],
        name="readings-test",
        on=date(2026, 9, 27),
    )

    assert report.startswith("# Readings side by side — readings-test")
    assert "| Gemini 3.7 Flash (low thinking) | 1 of 1 | 1 of 1 | 1 of 1 |" in report
    assert "| DeepSeek V4.1 Flash (thinking off) | 0 of 1 | 0 of 1 | 0 of 0 |" in report
    assert "#### DeepSeek V4.1 Flash (thinking off) — would be **refused**" in report
    assert "> a survey figure stated without its margin" in report
    assert "### Consumer reading" in report and "### Analyst reading" in report


def test_a_kept_trial_reads_back_as_it_was_written() -> None:
    _trial_with_sections = _trial(
        sections=[],
        figures=[1, 2],
    )
    assert Trial.from_json(_trial_with_sections.as_json()) == _trial_with_sections
