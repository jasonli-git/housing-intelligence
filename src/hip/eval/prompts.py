"""Turning a packet into the bytes a model sees.

Two payload formats over one contract. The same county packet is 6,043 tokens as JSON
and 2,096 as Markdown — identical information, three times the context. On a machine
where 16GB of unified memory is the binding constraint that is a design decision, not a
detail, so the format is a parameter of the evaluation rather than a hardcoded choice.

The Markdown rendering deliberately reuses `hip.packets.report`, the renderer Milestone 6
already built for human readers. Writing a second, model-specific renderer would mean the
thing being evaluated was no longer the published contract.
"""

from __future__ import annotations

from hip.packets import Packet, render_markdown


def estimate_tokens(text: str) -> int:
    """Rough token count: characters over four, the usual English approximation.

    An estimate on purpose. An exact count needs each model's own tokenizer, which
    would make the *scenario* — the thing every model is supposed to receive
    identically — differ per model. This is used for reporting and for the context
    check, never for billing.
    """
    return max(1, len(text) // 4)


def render_payload(packet: Packet, payload_format: str) -> str:
    """The packet as the model receives it."""
    if payload_format == "json":
        return packet.model_dump_json(indent=2)
    if payload_format == "markdown":
        return render_markdown(packet)
    raise ValueError(f"unknown payload format '{payload_format}' (json | markdown)")


def build_prompt(system_prompt: str, payload: str, question: str) -> str:
    """Assemble the single user-visible prompt.

    One string rather than a chat structure: Ollama's `/api/generate` and MLX-LM's
    `stream_generate` both take a prompt, and the chat-template path differs per model
    in ways that would leak into the comparison. The system prompt is prepended here so
    both cohorts receive byte-identical input.

    The packet comes before the question so the stable, cacheable part of the prompt
    leads — the same prefix-first ordering that matters for prompt caching, and it also
    means a truncated context loses the question rather than silently losing packet
    fields the model would then invent around.
    """
    return (
        f"{system_prompt.strip()}\n\n"
        f"--- DATA PACKET ---\n{payload.strip()}\n--- END DATA PACKET ---\n\n"
        f"Question: {question.strip()}\n"
    )


def fits_context(prompt: str, max_output_tokens: int, context_tokens: int) -> bool:
    """Whether prompt plus reserved output fits the configured context window.

    Worth checking before every generation because the failure is silent: Ollama
    truncates the prompt to `num_ctx` without an error, and the model answers from a
    fraction of the packet while looking entirely confident. A 6,043-token JSON packet
    at the old `num_ctx: 4096` lost a third of itself this way.
    """
    return estimate_tokens(prompt) + max_output_tokens <= context_tokens
