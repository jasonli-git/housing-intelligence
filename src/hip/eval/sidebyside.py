"""Both readings from several models on a few regions, set side by side to be read.

Milestone 30 chooses the consumer reading's model "by generating both formats with
DeepSeek, Gemini and Flash-Lite on three counties and reading them, not by guess". This
is that generation. Every candidate gets the prompt, packet, tier and gates `hip
explain` would give it, so what the owner reads is what would publish — and what would
be refused is shown too, with the reason, because a model that writes well and fails
the margin rule half the time is not the same choice as one that never does.

Nothing is stored in the warehouse: a comparison is evidence for a decision, not a
reading. The report is Markdown under `reports/evaluation/`, committed beside the three
benchmark reports it extends (SPEC: the report explains which model was selected and
why), and the raw trials go to `data/sidebyside/<name>/` — not `data/eval/`, where a
directory is a benchmark run — for anyone who wants the words a refused reading was
refused over.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Literal

from hip.config import Audience, EvaluationConfig
from hip.eval.costs import Usage
from hip.eval.explain import (
    GenerationFailed,
    ReadingRefused,
    UnboundFigures,
    judge_generation,
    run_model,
)
from hip.eval.formats import (
    MAX_FIGURES,
    QUESTIONS,
    Section,
    figures_in,
    revision_request,
    shape_consumer,
)
from hip.eval.runners import RunnerUnavailable
from hip.packets import Binding, Packet, bind

Status = Literal["published", "refused", "failed"]

# The three counties the roadmap's comparison is read on: the dearest county by home
# value in the north, Mercer — SPEC's example packet — in the middle, and Cumberland,
# the cheapest, in the south. Different markets, so a model that only reads one kind
# well shows it.
DEFAULT_REGIONS = (8, 11, 16)
# The roadmap's three candidates, and the local model both lists end on, which may
# write either reading when every hosted model fails and so is read too.
DEFAULT_MODELS = (
    "deepseek-flash-nothink",
    "gemini-3.7-flash-low",
    "gemini-3.1-flash-lite",
    "gemma-4-e4b-q4",
)


@dataclass
class Trial:
    """One model's reading of one region for one audience, and how the gates judged it."""

    region_id: int
    region_label: str
    audience: Audience
    model_id: str
    model_label: str
    status: Status
    reasons: list[str]
    # The shaped body where the reading could be shaped, the raw answer otherwise.
    body: str
    sections: list[Section] = field(default_factory=list)
    figures: list[int] = field(default_factory=list)
    words: int = 0
    seconds: float = 0.0
    prompt_tokens: int = 0
    output_tokens: int = 0
    tier: str | None = None
    # Summed over every attempt, revisions included.
    usd: float | None = None
    # Why each answer before the last was refused and sent back for revision (#266):
    # empty where the first answer was the one judged.
    refusals: list[list[str]] = field(default_factory=list)

    def as_json(self) -> dict[str, object]:
        record = asdict(self)
        record["sections"] = [section.as_json() for section in self.sections]
        return record

    @classmethod
    def from_json(cls, record: dict[str, Any]) -> Trial:
        fields = dict(record)
        sections: list[dict[str, Any]] = fields.pop("sections", None) or []
        return cls(**fields, sections=[Section(**s) for s in sections])

    def publishes_at(self, limit: int) -> bool:
        """Whether this reading would publish with at most `limit` figures an answer:
        published, or refused for figures per answer alone and within `limit`."""
        if self.status == "published":
            return True
        if self.status != "refused" or not self.figures:
            return False
        crowded = all(" figures under '" in reason for reason in self.reasons)
        return crowded and max(self.figures) <= limit


def _consumer_figures(
    body: str, packet: Packet, payload: str
) -> tuple[str, list[Section], list[int]]:
    """Shape and count a consumer reading the gates refused, so its figures per answer
    still show; empty where it could not be shaped at all."""
    try:
        shaped, sections = shape_consumer(body)
    except ValueError:
        return body, [], []
    binding = bind(shaped, packet, payload=payload)
    return shaped, sections, [figures_in(shaped, binding, s) for s in sections]


def trial(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    audience: Audience,
    *,
    payload_format: str = "markdown",
) -> Trial:
    """One model's reading, judged exactly as publication would judge it — a refused
    answer sent back for revision as `hip explain` sends it (#266)."""
    cohort = evaluation.cohort_for(model_id)
    started = time.perf_counter()
    revision: str | None = None
    refusals: list[list[str]] = []
    spent: list[Usage] = []
    published: tuple[str, list[Section], Binding] | None = None
    while True:
        try:
            generation, payload, usage = run_model(
                packet,
                evaluation,
                model_id,
                audience=audience,
                payload_format=payload_format,
                service_tier=cohort.generation_tier,
                revision=revision,
            )
        except (RunnerUnavailable, ValueError) as exc:
            billed = [u.usd for u in spent if u.usd is not None]
            return Trial(
                region_id=packet.region.region_id,
                region_label=packet.region.label,
                audience=audience,
                model_id=model_id,
                model_label=evaluation.model(model_id).label,
                status="failed",
                reasons=[str(exc)],
                body="",
                usd=sum(billed) if billed else None,
                refusals=refusals,
            )
        spent.append(usage)
        try:
            published = judge_generation(
                packet, generation, payload, audience=audience, usage=usage
            )
        except (ReadingRefused, UnboundFigures) as exc:
            if len(refusals) < evaluation.generation.revisions:
                refusals.append(exc.reasons())
                revision = revision_request(generation.answer, exc.reasons())
                continue
            status: Status = "refused"
            reasons = exc.reasons() if isinstance(exc, ReadingRefused) else [str(exc)]
        except GenerationFailed as exc:
            status, reasons = "failed", [str(exc)]
        else:
            status, reasons = "published", []
        break

    billed = [u.usd for u in spent if u.usd is not None]
    common: dict[str, Any] = {
        "region_id": packet.region.region_id,
        "region_label": packet.region.label,
        "audience": audience,
        "model_id": model_id,
        "model_label": evaluation.model(model_id).label,
        "seconds": time.perf_counter() - started,
        "prompt_tokens": sum(u.prompt_tokens for u in spent),
        "output_tokens": sum(u.generation_tokens for u in spent),
        "tier": usage.tier,
        "usd": sum(billed) if billed else None,
        "refusals": refusals,
    }
    if published is not None:
        body, sections, binding = published
        return Trial(
            **common,
            status="published",
            reasons=[],
            body=body,
            sections=sections,
            figures=[figures_in(body, binding, s) for s in sections],
            words=len(body.split()),
        )

    raw = generation.answer.strip()
    shown, laid, figures = raw, list[Section](), list[int]()
    if audience == "consumer" and raw:
        shown, laid, figures = _consumer_figures(raw, packet, payload)
    return Trial(
        **common,
        status=status,
        reasons=reasons,
        body=shown,
        sections=laid,
        figures=figures,
        words=len(shown.split()),
    )


def compare(
    packets: Sequence[Packet],
    evaluation: EvaluationConfig,
    models: Sequence[str],
    *,
    audiences: Sequence[Audience] = ("consumer", "analyst"),
    progress: Callable[[Trial], None] | None = None,
) -> list[Trial]:
    """Every model's reading of every packet for every audience."""
    trials: list[Trial] = []
    for packet in packets:
        for audience in audiences:
            for model_id in models:
                result = trial(packet, evaluation, model_id, audience)
                trials.append(result)
                if progress is not None:
                    progress(result)
    return trials


def _money(usd: float | None) -> str:
    return "—" if usd is None else f"${usd:.4f}"


def _summary(trials: list[Trial], models: Sequence[str]) -> list[str]:
    lines = [
        f"| Model | Consumer published | …at {MAX_FIGURES + 1} figures an answer | "
        "Analyst published | Published after a revision | "
        "Consumer words | Figures per answer, most | Cost | Seconds, mean |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for model_id in models:
        mine = [t for t in trials if t.model_id == model_id]
        if not mine:
            continue
        consumer = [t for t in mine if t.audience == "consumer"]
        analyst = [t for t in mine if t.audience == "analyst"]
        words = [t.words for t in consumer if t.status == "published"]
        most = max((max(t.figures) for t in consumer if t.figures), default=0)
        billed = [t.usd for t in mine if t.usd is not None]
        lines.append(
            f"| {mine[0].model_label} "
            f"| {sum(t.status == 'published' for t in consumer)} of {len(consumer)} "
            f"| {sum(t.publishes_at(MAX_FIGURES + 1) for t in consumer)} "
            f"of {len(consumer)} "
            f"| {sum(t.status == 'published' for t in analyst)} of {len(analyst)} "
            f"| {sum(t.status == 'published' and bool(t.refusals) for t in mine)} "
            f"| {round(sum(words) / len(words)) if words else '—'} "
            f"| {most} "
            f"| {_money(sum(billed)) if billed else '—'} "
            f"| {sum(t.seconds for t in mine) / len(mine):.1f} |"
        )
    return lines


def _verdict(trial: Trial) -> str:
    if trial.status == "published":
        return "would publish"
    return f"would be **{trial.status}**"


def _body(trial: Trial) -> list[str]:
    """The reading as a page would lay it out: each answer under its question."""
    if trial.audience == "consumer" and trial.sections:
        lines: list[str] = []
        for section, figures in zip(trial.sections, trial.figures, strict=False):
            lines += [
                f"**{section.heading}** _({figures} "
                f"figure{'s' if figures != 1 else ''})_",
                "",
                trial.body[section.start : section.end],
                "",
            ]
        return lines
    return [trial.body or "_(no text)_", ""]


def render(
    trials: list[Trial],
    models: Sequence[str],
    *,
    name: str,
    on: date,
) -> str:
    """The side-by-side as Markdown: a summary, then every reading under its region."""
    regions = list(dict.fromkeys((t.region_id, t.region_label) for t in trials))
    lines = [
        f"# Readings side by side — {name}",
        "",
        f"Generated {on.isoformat()} by `hip eval readings`. Each model was given the "
        "prompt, packet (1.3, with margins and rank ranges), service tier and gates "
        "`hip explain` would give it, for "
        f"{len(regions)} counties: {', '.join(label for _, label in regions)}. Nothing "
        "was stored; a reading marked *refused* is shown with the rule it broke. "
        "A refused answer goes back to its model with the refusal, up to "
        "`generation.revisions` times, as it would in `hip explain`; each such refusal "
        "is listed above the reading. "
        "The consumer reading's model is chosen from this (ROADMAP, Milestone 30).",
        "",
        "The consumer reading answers, in this order: "
        + "; ".join(f"*{q.heading}*" for q in QUESTIONS)
        + ".",
        "",
        "## Summary",
        "",
        *_summary(trials, models),
        "",
        f"*…at {MAX_FIGURES + 1} figures an answer* counts the consumer readings that "
        f"would publish if an answer could state one figure more than {MAX_FIGURES}: "
        "those refused for figures per answer alone, with no answer over the new limit.",
        "",
        "Cost is what each model's generations here would bill, at the tier the "
        "provider says served them and, for DeepSeek, the hour they ran — an upper "
        "bound, since prompt-cache discounts are not counted. The local model is not "
        "billed per token. Seconds are wall-clock, network included.",
        "",
    ]
    for region_id, label in regions:
        lines += [f"## {label}", ""]
        for audience in ("consumer", "analyst"):
            here = [
                t for t in trials if t.region_id == region_id and t.audience == audience
            ]
            if not here:
                continue
            lines += [f"### {audience.capitalize()} reading", ""]
            for item in here:
                lines += [
                    f"#### {item.model_label} — {_verdict(item)}",
                    "",
                    f"_{item.words} words · {item.output_tokens:,} tokens out · "
                    f"{item.seconds:.1f}s · {_money(item.usd)}"
                    + (f" · {item.tier}" if item.tier else "")
                    + "_",
                    "",
                ]
                for number, refusal in enumerate(item.refusals, start=1):
                    lines += [
                        f"_Answer {number} refused and sent back for revision:_ "
                        + "; ".join(refusal),
                        "",
                    ]
                for reason in item.reasons:
                    lines += [f"> {reason}", ""]
                lines += _body(item)
    return "\n".join(lines).rstrip() + "\n"


def write(report: str, *, report_path: Path) -> None:
    """The report where it is committed. The raw trials are kept as they complete, by
    the command, where data lives."""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")


__all__ = [
    "DEFAULT_MODELS",
    "DEFAULT_REGIONS",
    "Trial",
    "compare",
    "render",
    "trial",
    "write",
]
