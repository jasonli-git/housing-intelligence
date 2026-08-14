"""The evaluation harness, tested without a model or a warehouse.

Everything here is a pure function over a packet, a generation, or a config, which is
the point of the module layout: the parts that decide whether a model is good are
separable from the parts that run one. A test suite that needed 5GB of weights resident
would not be run.

`tests/test_packets.py` supplies the packet fixtures; this file reuses that shape rather
than inventing a second packet builder that could drift from the real contract.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

import pytest

from hip.config import EvaluationConfig, load_evaluation
from hip.eval.checks import check_generation, packet_values, parse_numbers
from hip.eval.judge import build_judge_prompt, verdict_schema, weighted
from hip.eval.normalize import looks_like_refusal, split_reasoning
from hip.eval.prompts import build_prompt, estimate_tokens, fits_context, render_payload
from hip.eval.report import anchor_pairs, render_report, select_winner, summarize
from hip.eval.runner import plan, sampling_for
from hip.eval.scenarios import sample_regions, scenarios_for_packet
from hip.eval.store import read_records, write_records
from hip.eval.types import (
    CriterionScore,
    Generation,
    Judgment,
    Scenario,
    Telemetry,
)
from hip.packets.schema import (
    Packet,
    PacketComparisons,
    PacketHighlight,
    PacketLevel,
    PacketMetric,
    PacketRegion,
    PacketSource,
    PacketWindow,
    packet_hash,
)

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


@pytest.fixture(scope="module")
def evaluation() -> EvaluationConfig:
    """The real config/evaluation.yml — a fixture copy would drift from it."""
    return load_evaluation(CONFIG_DIR)


@pytest.fixture
def packet() -> Packet:
    return Packet(
        packet_version="1.1",
        region=PacketRegion(
            region_id=11,
            geoid="34021",
            level="county",
            name="Mercer",
            label="Mercer County, NJ",
            state_code="NJ",
        ),
        window=PacketWindow(label="5y", start=date(2020, 6, 1), end=date(2025, 6, 1)),
        metrics=[
            PacketMetric(
                metric_id="zhvi_sfr",
                label="Home value",
                unit="usd",
                direction="neutral",
                window_start=date(2020, 6, 1),
                window_end=date(2025, 6, 1),
                start_value=310000.0,
                end_value=452500.0,
                pct_change=45.97,
                cagr=7.86,
                rank=4,
                of=21,
                percentile=0.81,
            )
        ],
        levels=[
            PacketLevel(
                metric_id="modiv_median_assessed_value",
                label="Median assessed value",
                unit="usd",
                direction="neutral",
                value=289400.0,
                period_start=date(2025, 1, 1),
                period_end=date(2025, 12, 31),
                rank=6,
                of=554,
            )
        ],
        comparisons=PacketComparisons(
            peer_level="county", peer_scope="NJ", peer_count=21
        ),
        highlights=[
            PacketHighlight(
                metric_id="zhvi_sfr",
                label="Home value",
                position="leading",
                rank=4,
                of=21,
                pct_change=45.97,
            )
        ],
        caveats=["ZIP-level figures are allocated, not observed."],
        sources=[
            PacketSource(
                source_id="zillow",
                name="Zillow Research",
                publisher="Zillow",
                license="free-to-use",
                url="https://example.invalid",
                vintage="2025",
                fetched_at=datetime(2026, 8, 12, 10, 0, 0),
                release_ids=[7],
            )
        ],
    )


def _generation(
    answer: str, model_id: str = "qwen3-8b-q4", **kwargs: object
) -> Generation:
    defaults: dict[str, object] = {
        "scenario_key": "headline_change:11:json",
        "scenario_id": "headline_change",
        "region_id": 11,
        "model_id": model_id,
        "cohort": "gguf",
        "mode": "deterministic",
        "answer": answer,
        "raw": answer,
        "telemetry": Telemetry(
            prompt_tokens=1500,
            generation_tokens=200,
            generation_ms=4000.0,
            total_ms=4500.0,
            tokens_per_second=50.0,
        ),
    }
    defaults.update(kwargs)
    return Generation.model_validate(defaults)


def _scenario(**kwargs: object) -> Scenario:
    defaults: dict[str, object] = {
        "scenario_id": "headline_change",
        "region_id": 11,
        "region_label": "Mercer County, NJ",
        "window": "5y",
        "question": "Which metric changed most?",
        "payload_format": "json",
        "payload": "{}",
        "payload_tokens": 10,
    }
    defaults.update(kwargs)
    return Scenario.model_validate(defaults)


# --- reasoning normalization -------------------------------------------------------


def test_inline_think_tags_are_stripped_from_the_answer() -> None:
    answer, reasoning, truncated = split_reasoning(
        "<think>the packet says 45.97</think>Home values rose 46%."
    )
    assert answer == "Home values rose 46%."
    assert reasoning == "the packet says 45.97"
    assert not truncated


def test_ollama_thinking_field_is_reasoning_not_answer() -> None:
    answer, reasoning, _ = split_reasoning("Values rose.", thinking_field="let me check")
    assert answer == "Values rose."
    assert reasoning == "let me check"


def test_unterminated_think_is_marked_truncated_not_treated_as_answer() -> None:
    """The budget ran out mid-thought. That is neither an answer nor a refusal."""
    answer, reasoning, truncated = split_reasoning("<think>I should first check the")
    assert answer == ""
    assert truncated
    assert "I should first check" in reasoning


def test_text_before_an_unterminated_think_survives() -> None:
    answer, _, truncated = split_reasoning("Short answer.<think>but wait, the")
    assert answer == "Short answer."
    assert truncated


def test_both_runtimes_yield_the_same_answer_for_the_same_model() -> None:
    """The whole reason this module exists: one grader input, two runtimes."""
    ollama_answer, _, _ = split_reasoning("Values rose 46%.", thinking_field="checking")
    mlx_answer, _, _ = split_reasoning("<think>checking</think>Values rose 46%.")
    assert ollama_answer == mlx_answer


@pytest.mark.parametrize(
    "text",
    [
        "The packet does not contain data for 1985.",
        "I cannot answer that from this packet.",
        "No information about 2008 permits is available in the packet.",
    ],
)
def test_declines_are_recognized(text: str) -> None:
    assert looks_like_refusal(text)


def test_a_long_answer_containing_a_hedge_is_not_a_refusal() -> None:
    """A disclaimer inside an essay is a hedge, not a decline."""
    essay = "Values rose sharply. " * 60 + "Some data is not available in the packet."
    assert not looks_like_refusal(essay)


def test_empty_answer_is_not_a_refusal() -> None:
    assert not looks_like_refusal("   ")


# --- deterministic numeric checks --------------------------------------------------


def test_numbers_are_parsed_as_written() -> None:
    parsed = dict((text, value) for value, text in parse_numbers("$452,500 rose 45.97%"))
    assert parsed["$452,500"] == 452500.0
    assert parsed["45.97%"] == 45.97


def test_packet_values_include_rounded_and_percentage_forms(packet: Packet) -> None:
    values = packet_values(packet)
    assert 452500.0 in values
    assert 45.97 in values
    assert 46.0 in values  # rounded, as a writer would quote it
    assert 21.0 in values  # peer count


def test_quoted_figures_count_as_supported(packet: Packet) -> None:
    generation = _generation(
        "Home values rose 45.97% to $452,500, ranking 4 of 21 counties."
    )
    result = check_generation(generation, _scenario(), packet)
    assert result.unsupported_count == 0
    assert result.unsupported_rate == 0.0


def test_an_invented_figure_is_caught(packet: Packet) -> None:
    generation = _generation("Home values rose to $612,300, a gain of 88.4%.")
    result = check_generation(generation, _scenario(), packet)
    assert result.unsupported_count == 2
    assert result.unsupported_rate == 1.0
    assert {c.value for c in result.numbers if not c.supported} == {612300.0, 88.4}


def test_rounding_is_not_treated_as_fabrication(packet: Packet) -> None:
    """ "about $452,000" is a correct quotation, not a new claim."""
    result = check_generation(_generation("roughly $452,000"), _scenario(), packet)
    assert result.unsupported_count == 0


def test_small_ordinals_are_ignored(packet: Packet) -> None:
    """ "the 3 points below" is prose, not a claim about the data."""
    generation = _generation("There are 3 points to note.")
    result = check_generation(generation, _scenario(), packet)
    assert result.numbers == []


def test_expected_refusal_is_scored_correct(packet: Packet) -> None:
    scenario = _scenario(scenario_id="refusal", expects_refusal=True)
    generation = _generation("The packet does not contain 1985 income data.")
    result = check_generation(generation, scenario, packet)
    assert result.refused
    assert result.refusal_correct


def test_answering_a_question_that_should_be_refused_is_scored_wrong(
    packet: Packet,
) -> None:
    scenario = _scenario(scenario_id="refusal", expects_refusal=True)
    result = check_generation(_generation("Median income was $61,000."), scenario, packet)
    assert not result.refused
    assert not result.refusal_correct


def test_empty_answers_are_flagged(packet: Packet) -> None:
    result = check_generation(_generation(""), _scenario(), packet)
    assert result.empty_answer


# --- prompts and payloads ----------------------------------------------------------


def test_markdown_payload_is_far_smaller_than_json(packet: Packet) -> None:
    """The 3x token gap that makes payload format a design decision."""
    as_json = estimate_tokens(render_payload(packet, "json"))
    as_markdown = estimate_tokens(render_payload(packet, "markdown"))
    assert as_markdown < as_json


def test_unknown_payload_format_is_rejected(packet: Packet) -> None:
    with pytest.raises(ValueError, match="unknown payload format"):
        render_payload(packet, "yaml")


def test_prompt_places_the_packet_before_the_question() -> None:
    prompt = build_prompt("SYSTEM", "PAYLOAD", "QUESTION")
    assert prompt.index("PAYLOAD") < prompt.index("QUESTION")
    assert prompt.startswith("SYSTEM")


def test_context_check_rejects_a_prompt_that_would_be_truncated() -> None:
    """The failure this prevents is silent: Ollama truncates without an error."""
    assert not fits_context("x" * 40_000, 1600, 4096)
    assert fits_context("x" * 4_000, 1600, 12288)


# --- scenarios ---------------------------------------------------------------------


def test_region_sampling_is_deterministic_and_spread() -> None:
    ids = list(range(100, 200))
    assert sample_regions(ids, 3) == sample_regions(ids, 3)
    assert sample_regions(ids, 3) == [100, 133, 166]


def test_sampling_more_than_available_returns_everything() -> None:
    assert sample_regions([3, 1, 2], 10) == [1, 2, 3]


def test_every_configured_question_is_asked_of_each_packet(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    scenarios = scenarios_for_packet(packet, evaluation, "json")
    assert len(scenarios) == len(evaluation.scenarios)
    assert {s.scenario_id for s in scenarios} == {s.id for s in evaluation.scenarios}
    assert all(s.region_id == 11 for s in scenarios)


def test_scenario_key_is_independent_of_the_model() -> None:
    assert _scenario().key == "headline_change:11:json"


# --- run planning ------------------------------------------------------------------


def test_plan_covers_every_model_and_scenario(evaluation: EvaluationConfig) -> None:
    scenarios = [_scenario(), _scenario(scenario_id="affordability")]
    steps = plan(evaluation, scenarios)
    assert len(steps) == len(evaluation.models) * 2


def test_plan_groups_by_model_so_each_loads_once(evaluation: EvaluationConfig) -> None:
    """Scenario-first ordering would reload a multi-gigabyte model per question."""
    scenarios = [_scenario(), _scenario(scenario_id="affordability")]
    order = [model_id for model_id, _, _ in plan(evaluation, scenarios)]
    assert order == sorted(order, key=order.index)
    assert order[0] == order[1]


def test_stability_mode_repeats_each_scenario(evaluation: EvaluationConfig) -> None:
    steps = plan(evaluation, [_scenario()], mode="stability", repeats=3)
    assert len(steps) == len(evaluation.models) * 3


def test_sampling_mode_must_be_known(evaluation: EvaluationConfig) -> None:
    with pytest.raises(ValueError, match="unknown sampling mode"):
        sampling_for(evaluation, "typo")


def test_stability_varies_the_seed_across_repeats(evaluation: EvaluationConfig) -> None:
    """A fixed seed at temperature 0.7 measures reproducibility, not stability."""
    from hip.eval.runner import _seed_for

    seeds = {_seed_for(evaluation, "stability", r) for r in range(3)}
    assert len(seeds) == 3


def test_deterministic_mode_pins_one_seed(evaluation: EvaluationConfig) -> None:
    from hip.eval.runner import _seed_for

    assert _seed_for(evaluation, "deterministic", 0) == _seed_for(
        evaluation, "deterministic", 5
    )


# --- judge -------------------------------------------------------------------------


def test_verdict_schema_covers_every_configured_criterion(
    evaluation: EvaluationConfig,
) -> None:
    """Adding a criterion to YAML must not leave the schema behind."""
    schema = verdict_schema(evaluation.rubric)
    properties = schema["properties"]["scores"]["properties"]
    assert set(properties) == {c.id for c in evaluation.rubric.criteria}
    assert schema["properties"]["scores"]["required"] == list(properties)


def test_verdict_schema_forbids_extra_fields(evaluation: EvaluationConfig) -> None:
    assert verdict_schema(evaluation.rubric)["additionalProperties"] is False


def test_verdict_schema_uses_no_unsupported_json_schema_keywords(
    evaluation: EvaluationConfig,
) -> None:
    """Structured outputs reject numeric range constraints and string-length bounds.

    A schema carrying `minimum`/`maximum` is not rejected at build time — it fails at
    request time, per request. The first judging batch came back 105 errored for 105
    submitted on exactly this, and the run had to be resubmitted.
    """
    banned = {
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
    }

    def walk(node: object, path: str = "") -> list[str]:
        found: list[str] = []
        if isinstance(node, dict):
            found += [f"{path}.{k}" for k in node if k in banned]
            for key, value in node.items():
                found += walk(value, f"{path}.{key}")
        elif isinstance(node, list):
            for i, value in enumerate(node):
                found += walk(value, f"{path}[{i}]")
        return found

    assert walk(verdict_schema(evaluation.rubric)) == []


def test_verdict_scores_are_bounded_by_an_enum(evaluation: EvaluationConfig) -> None:
    """The bound still has to be enforced — just in a form the API accepts."""
    first = evaluation.rubric.criteria[0].id
    score = verdict_schema(evaluation.rubric)["properties"]["scores"]["properties"][
        first
    ]["properties"]["score"]
    assert score["enum"] == [0, 1, 2, 3, 4]


def test_weighted_score_follows_the_configured_weights(
    evaluation: EvaluationConfig,
) -> None:
    perfect = {
        c.id: CriterionScore(score=4.0, justification="")
        for c in evaluation.rubric.criteria
    }
    assert weighted(perfect, evaluation.rubric) == 4.0

    zeroed = {
        c.id: CriterionScore(score=0.0, justification="")
        for c in evaluation.rubric.criteria
    }
    assert weighted(zeroed, evaluation.rubric) == 0.0


def test_accuracy_is_weighted_above_clarity(evaluation: EvaluationConfig) -> None:
    """A model that writes beautifully and invents a number must not average out."""
    weights = {c.id: c.weight for c in evaluation.rubric.criteria}
    assert weights["factual_accuracy"] > weights["clarity"]


def test_judge_prompt_carries_the_packet_the_model_saw(
    evaluation: EvaluationConfig,
) -> None:
    scenario = _scenario(payload='{"marker": 12345}')
    prompt = build_judge_prompt(_generation("answer"), scenario, evaluation.rubric)
    assert "12345" in prompt
    assert "answer" in prompt


def test_judge_prompt_marks_an_empty_answer_explicitly(
    evaluation: EvaluationConfig,
) -> None:
    prompt = build_judge_prompt(_generation(""), _scenario(), evaluation.rubric)
    assert "returned nothing" in prompt


# --- store -------------------------------------------------------------------------


def test_records_round_trip_through_jsonl(tmp_path: Path) -> None:
    path = tmp_path / "generations.jsonl"
    written = [_generation("one"), _generation("two", model_id="gemma-4-e4b-q4")]
    assert write_records(path, written) == 2
    assert [g.answer for g in read_records(path, Generation)] == ["one", "two"]


def test_missing_artifact_reads_as_empty(tmp_path: Path) -> None:
    assert read_records(tmp_path / "absent.jsonl", Generation) == []


# --- report ------------------------------------------------------------------------


def _judgment(
    key: str, model_id: str, score: float, evaluation: EvaluationConfig
) -> Judgment:
    return Judgment(
        generation_key=key,
        model_id=model_id,
        scenario_id="headline_change",
        scores={
            c.id: CriterionScore(score=score, justification="")
            for c in evaluation.rubric.criteria
        },
        summary="",
        weighted_score=score,
    )


def test_summary_folds_checks_and_judgments_together(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    generation = _generation("Home values rose 45.97% to $452,500.")
    check = check_generation(generation, _scenario(), packet)
    judgment = _judgment(generation.key, generation.model_id, 3.5, evaluation)

    summaries = summarize(evaluation, [generation], [check], [judgment])
    summary = summaries["qwen3-8b-q4"]
    assert summary.generations == 1
    assert summary.hallucination_rate == 0.0
    assert summary.mean_score == 3.5


def test_hallucination_rate_is_counted_not_graded(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    """No judgment involved — the rate comes from the deterministic checker alone."""
    generation = _generation("Values reached $612,300.")
    check = check_generation(generation, _scenario(), packet)
    summaries = summarize(evaluation, [generation], [check], [])
    assert summaries["qwen3-8b-q4"].hallucination_rate == 1.0


def test_a_fabricating_model_cannot_win_however_well_it_scores(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    """The deterministic gate, which is the point of separating the two layers."""
    liar = _generation("Values reached $612,300.", model_id="qwen3-8b-q4")
    honest = _generation(
        "Home values rose 45.97% to $452,500.", model_id="gemma-4-e4b-q4"
    )
    checks = [
        check_generation(liar, _scenario(), packet),
        check_generation(honest, _scenario(), packet),
    ]
    judgments = [
        _judgment(liar.key, liar.model_id, 4.0, evaluation),  # graded perfect
        _judgment(honest.key, honest.model_id, 2.5, evaluation),
    ]
    winner = select_winner(summarize(evaluation, [liar, honest], checks, judgments))
    assert winner is not None
    assert winner.model_id == "gemma-4-e4b-q4"


def test_no_winner_when_nothing_has_been_judged(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    generation = _generation("Home values rose 45.97%.")
    check = check_generation(generation, _scenario(), packet)
    assert select_winner(summarize(evaluation, [generation], [check], [])) is None


def test_anchor_pairs_span_both_cohorts(evaluation: EvaluationConfig) -> None:
    gguf = _generation("a", model_id="qwen3-8b-q4")
    mlx = _generation("b", model_id="qwen3-8b-mlx")
    mlx = mlx.model_copy(update={"cohort": "mlx"})
    pairs = anchor_pairs(evaluation, summarize(evaluation, [gguf, mlx], [], []))
    assert [anchor for anchor, _, _ in pairs] == ["qwen3-8b"]
    _, first, second = pairs[0]
    assert {first.cohort, second.cohort} == {"gguf", "mlx"}


def test_report_leads_with_anchors_then_the_leaderboard(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    """Ordering is the argument: the anchors license the cross-cohort table."""
    gguf = _generation("Values rose 45.97%.", model_id="qwen3-8b-q4")
    mlx = _generation("Values rose 45.97%.", model_id="qwen3-8b-mlx").model_copy(
        update={"cohort": "mlx"}
    )
    generations = [gguf, mlx]
    checks = [check_generation(g, _scenario(), packet) for g in generations]
    judgments = [_judgment(g.key, g.model_id, 3.0, evaluation) for g in generations]

    text = render_report(
        evaluation, [_scenario()], generations, checks, judgments, run="t"
    )
    assert text.index("Anchor comparison") < text.index("Rubric scores")
    assert "Deterministic checks" in text
    assert "data/eval/t/" in text


def test_unjudged_report_says_so_instead_of_recommending(
    packet: Packet, evaluation: EvaluationConfig
) -> None:
    generation = _generation("Values rose 45.97%.")
    check = check_generation(generation, _scenario(), packet)
    text = render_report(evaluation, [_scenario()], [generation], [check], [], run="t")
    assert "Not yet judged" in text
    assert "Selected model" not in text


# --- packet hash -------------------------------------------------------------------


def test_packet_hash_is_stable_across_rebuilds(packet: Packet) -> None:
    """Packets carry no wall clock, so an identical packet hashes identically."""
    assert packet_hash(packet) == packet_hash(packet.model_copy(deep=True))


def test_packet_hash_changes_when_a_number_changes(packet: Packet) -> None:
    moved = packet.model_copy(deep=True)
    moved.metrics[0].end_value = 999999.0
    assert packet_hash(moved) != packet_hash(packet)


# --- config ------------------------------------------------------------------------


def test_every_model_id_is_unique(evaluation: EvaluationConfig) -> None:
    ids = [m.id for m in evaluation.models]
    assert len(ids) == len(set(ids))


def test_every_candidate_is_four_bit(evaluation: EvaluationConfig) -> None:
    """Precision was retired as a variable; a stray Q8 would silently reintroduce it."""
    assert all("4" in m.quantization for m in evaluation.models)


def test_cohort_lookup_round_trips(evaluation: EvaluationConfig) -> None:
    for candidate in evaluation.models:
        cohort = evaluation.cohort_of(candidate.id)
        assert candidate in evaluation.cohorts[cohort].models


def test_sampling_is_pinned_on_every_axis(evaluation: EvaluationConfig) -> None:
    """An unset field means two different defaults across the two runtimes."""
    deterministic = evaluation.sampling.deterministic
    assert deterministic.temperature == 0.0
    assert deterministic.top_k == 1
    assert deterministic.seed is not None


def test_a_refusal_scenario_exists(evaluation: EvaluationConfig) -> None:
    """Without one, a model that always answers confidently scores well everywhere."""
    assert any(s.expects_refusal for s in evaluation.scenarios)


# --- checker false positives (found on a real run, 2026-08-13) ----------------------


def test_iso_dates_are_not_torn_into_negative_numbers(packet: Packet) -> None:
    """`2019-12-31` once parsed as 2019, -12, -31 — three fabrications per citation.

    Caught on a live run: a model correctly citing its window produced the single most
    common "unsupported" figure in the whole evaluation. The metric it corrupts is the
    headline one, so this stays as a regression test.
    """
    assert parse_numbers("the window 2019-12-31 to 2024-12-31") == []
    result = check_generation(
        _generation("Permits rose over 2019-12-31 → 2024-12-31."), _scenario(), packet
    )
    assert result.unsupported_count == 0


def test_year_ranges_are_not_numbers(packet: Packet) -> None:
    assert parse_numbers("over 2019-2024") == []
    assert parse_numbers("over 2019–2024") == []


def test_a_figure_inside_a_metric_name_is_not_fabricated(packet: Packet) -> None:
    """The phrase 'Renters paying over 30% of income' is the packet's own label."""
    scenario = _scenario(payload="| Renters paying over 30% of income | 0.55 |")
    result = check_generation(
        _generation("Renters paying over 30% of income are 0.55."), scenario, packet
    )
    assert result.unsupported_count == 0


def test_a_number_echoed_from_the_question_is_not_a_claim(packet: Packet) -> None:
    """The refusal scenario names 1985; declining while repeating it is correct."""
    scenario = _scenario(
        scenario_id="refusal",
        expects_refusal=True,
        question="What was median income in 1985?",
    )
    result = check_generation(
        _generation("The packet has no data for 1985."), scenario, packet
    )
    assert result.unsupported_count == 0
    assert result.refusal_correct


def test_a_genuine_fabrication_still_fails_after_the_relaxations(
    packet: Packet,
) -> None:
    """The relaxations must not have hollowed out the check they protect."""
    result = check_generation(
        _generation("Values reached $612,300 on 2019-12-31, up 88.4%."),
        _scenario(),
        packet,
    )
    assert {c.value for c in result.numbers if not c.supported} == {612300.0, 88.4}


def test_output_budget_covers_reasoning_not_just_the_answer(
    evaluation: EvaluationConfig,
) -> None:
    """Measured 2026-08-13: Qwen3-8B wrote 5,747 characters of reasoning before its
    answer and returned nothing at a 1,600-token cap.

    A budget sized for the answer alone truncates reasoning models specifically, which
    biases the whole comparison against them — the confound this milestone exists to
    avoid. Roughly 4 characters per token, so the trace alone is ~1,440 tokens.
    """
    assert evaluation.limits.max_output_tokens >= 2500


def test_output_budget_clears_the_slowest_models_natural_peak(
    evaluation: EvaluationConfig,
) -> None:
    """gemma-4-12b answers cleanly up to 2,785 tokens and returns nothing past the cap.

    A budget that merely grazes a model's natural stopping point measures the harness,
    not the model: 7 of its 15 scenarios stopped normally and the other 8 came back
    empty at 3,000. Twice the observed peak is the floor for a fair comparison.
    """
    assert evaluation.limits.max_output_tokens >= 2 * 2785


def test_context_window_holds_a_packet_plus_the_output_budget(
    evaluation: EvaluationConfig,
) -> None:
    """A JSON county packet is ~6,000 tokens; the context must fit it and the answer."""
    limits = evaluation.limits
    assert limits.context_tokens >= 6000 + limits.max_output_tokens


# --- MLX chat templating (found by the anchor pair, 2026-08-13) ---------------------


class _FakeTokenizer:
    chat_template = "present"

    def apply_chat_template(self, messages: list[dict[str, str]], **_: object) -> str:
        body = messages[0]["content"]
        return f"<|im_start|>user\n{body}<|im_end|>\n<|im_start|>assistant\n"


def test_mlx_prompts_are_wrapped_in_the_models_instruct_format() -> None:
    """Untemplated, the model never emits its end-of-turn token and never stops.

    Measured on Qwen3-8B across both runtimes: templated GGUF stopped at 528 tokens;
    untemplated MLX ran to the 3,000-token cap on the same prompt, inflating its
    stated-figure count from 89 to 1,461. Ollama templates server-side, so doing it here
    is what makes the cohorts comparable at all.
    """
    from hip.eval.runners.mlx_runner import apply_chat_template

    out = apply_chat_template(_FakeTokenizer(), "PROMPT BODY")
    assert out.startswith("<|im_start|>user")
    assert "PROMPT BODY" in out
    assert out.endswith("<|im_start|>assistant\n")


def test_a_tokenizer_without_a_template_passes_the_prompt_through() -> None:
    from hip.eval.runners.mlx_runner import apply_chat_template

    class Bare:
        chat_template = None

    assert apply_chat_template(Bare(), "PROMPT") == "PROMPT"
