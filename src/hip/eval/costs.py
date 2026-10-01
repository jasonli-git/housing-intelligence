"""What one generation cost, at the rate it actually billed at (Milestone 30).

The configured rates are each candidate's standard, peak list prices — the higher ones,
so an estimate is never below the bill. A generation can bill lower, and `hip explain`
reports what a run cost rather than what it would have cost at list price:

- **A discounted tier the provider says served it.** Gemini's Flex tier bills at half,
  and the response names the tier (`Telemetry.service_tier`), so the rate follows what
  the provider did rather than what was asked for.
- **Off-peak hours.** DeepSeek bills half outside its peak windows, decided by the time
  the call was made.

Still an upper bound: neither provider's prompt-cache discount is priced. Each reports
its cache hits differently; since 2026-10-01 both are counted (`Usage.cached_tokens`) so
the discount can be measured before it is priced. A local model is not billed
per token at all — its cost is `None`, never 0.0, as in the evaluation's cost column.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from hip.config import CandidateModel, Cohort


@dataclass(frozen=True)
class Usage:
    """One billed (or local) generation: the tokens, the tier, and the price."""

    model_id: str
    prompt_tokens: int
    generation_tokens: int
    tier: str | None
    usd: float | None
    off_peak: bool = False
    # A reachability probe before the run (`hip explain`'s model check), not a reading.
    probe: bool = False
    # Of `prompt_tokens`, those the provider served from its cache. Counted, not yet
    # priced: `usd` stays the upper bound until the discount per provider is configured.
    cached_tokens: int = 0


def generation_usd(
    candidate: CandidateModel,
    cohort: Cohort,
    prompt_tokens: int,
    generation_tokens: int,
    *,
    tier: str | None,
    at: datetime,
) -> tuple[float | None, bool]:
    """The price of one generation, and whether it billed at an off-peak rate."""
    listed = candidate.usd_for(prompt_tokens, generation_tokens)
    if listed is None:
        return None, False
    factor = cohort.tier_rates.get(tier, 1.0) if tier else 1.0
    off_peak = cohort.off_peak is not None and cohort.off_peak.discounted(at)
    if off_peak and cohort.off_peak is not None:
        factor *= cohort.off_peak.rate
    return listed * factor, off_peak


__all__ = ["Usage", "generation_usd"]
