"""Separating a model's reasoning from its final answer.

The two runtimes surface reasoning differently for the *same model and the same
prompt*: Ollama splits it into a `thinking` field on the response, while MLX-LM leaves
`<think>` tags inline in the generated text. Handing the grader whichever one it happens
to get would score one cohort on its reasoning and the other on its answer.

The unterminated case matters as much as the tagged one. A reasoning model that exhausts
its output budget mid-thought emits an opening `<think>` and no close; treating that text
as an answer records a thoughtful model as an incoherent one, and treating it as empty
records it as a refusal. It is neither — it was cut off, and `truncated_reasoning` says
so.
"""

from __future__ import annotations

import re

# Runtimes and fine-tunes differ on the tag; all of these appear in the wild.
_OPEN = r"(?:think|thinking|reasoning)"
_TAGGED = re.compile(rf"<({_OPEN})>(.*?)</\1>", re.DOTALL | re.IGNORECASE)
_UNTERMINATED = re.compile(rf"<({_OPEN})>(.*)$", re.DOTALL | re.IGNORECASE)


def split_reasoning(
    text: str, thinking_field: str | None = None
) -> tuple[str, str, bool]:
    """Return ``(answer, reasoning, truncated)``.

    ``thinking_field`` is Ollama's out-of-band reasoning, which is authoritative when
    present. Inline tags are still stripped afterwards, because a model can emit both.
    """
    reasoning_parts: list[str] = []
    if thinking_field:
        reasoning_parts.append(thinking_field.strip())

    body = text or ""
    for match in _TAGGED.finditer(body):
        reasoning_parts.append(match.group(2).strip())
    body = _TAGGED.sub("", body)

    truncated = False
    unterminated = _UNTERMINATED.search(body)
    if unterminated:
        # Everything from the opening tag onward is reasoning that never closed. What
        # precedes it is a real (if unusual) answer and is kept.
        reasoning_parts.append(unterminated.group(2).strip())
        body = body[: unterminated.start()]
        truncated = True

    reasoning = "\n\n".join(part for part in reasoning_parts if part)
    return body.strip(), reasoning, truncated


# Phrases that mark a model declining, rather than answering badly. Deliberately narrow:
# this feeds a scored check, so a false positive would credit a model for a refusal it
# never made. Detection requires one of these *and* an answer short enough that the model
# is plainly not also answering (see `looks_like_refusal`).
_REFUSAL_MARKERS = (
    "does not contain",
    "doesn't contain",
    "does not include",
    "doesn't include",
    "not in the packet",
    "not present in the packet",
    "no information",
    "cannot answer",
    "can't answer",
    "cannot determine",
    "can't determine",
    "unable to answer",
    "not available in",
    "does not provide",
    "doesn't provide",
    "no data",
    "insufficient",
    "outside the packet",
    "not supported by",
)

# Above this, the model is writing an essay; any disclaimer inside it is a hedge
# attached to a substantive answer rather than a refusal. Tuned to be generous — a
# genuine decline is short, and scoring an essay as a refusal is the worse error.
_REFUSAL_MAX_WORDS = 160


def looks_like_refusal(answer: str) -> bool:
    """Whether the answer declines to answer, as opposed to answering poorly.

    A heuristic, and reported as one. The judge scores refusal quality under
    `instruction_following`; this exists so the deterministic layer can score the one
    scenario built specifically to elicit a decline without paying for a judgment.
    """
    stripped = answer.strip()
    if not stripped:
        return False
    lowered = stripped.lower()
    if len(stripped.split()) > _REFUSAL_MAX_WORDS:
        return False
    return any(marker in lowered for marker in _REFUSAL_MARKERS)
