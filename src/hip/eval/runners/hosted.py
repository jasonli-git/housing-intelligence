"""The hosted cohorts, served by three vendors behind one runner.

One class rather than three, because what differs between DeepSeek, Gemini, and Mistral
on this task is small and mechanical: the auth header, the path, and where the usage
counters sit in the response. Everything that is not mechanical — retry policy, the
error-is-a-finding contract, telemetry normalization, the refusal to invent a memory
figure — is identical, and having it in one place is why a fourth provider is a
`_Dialect` entry rather than a new module.

Raw `httpx` rather than three vendor SDKs, matching how `OllamaRunner` already talks to
its runtime. Three SDKs would be three dependency surfaces, three auth abstractions, and
three release cadences in service of a single non-streaming chat call.

**Why not a router.** OpenRouter would supply this breadth through one integration and
is rejected on provenance: `region_explanations` records the model that wrote every row
and the dashboard shows it, so a service that silently selects a different backend would
put prose from an unbenchmarked model on a public page (ROADMAP, Milestone 12).

**What a hosted runtime cannot report.** `peak_memory_mb` and `load_ms` stay null and
`memory_basis` gains no third value. The memory of a machine we do not own is not a
number this evaluation can honestly print, and `memory_basis` exists precisely so that a
column is never silently filled with a differently-meaning figure (`base.py`).

**Sampling is sent where it is accepted and dropped where it is not.** The local cohorts
pin five parameters so that two runtimes are not compared under different defaults. A
hosted provider exposes a subset — `top_k` and `repeat_penalty` are not part of these
three APIs — so the runner sends what each accepts and records nothing about the rest.
The comparison this licenses is weaker than the local one, which is a real cost of
hosting and is written down rather than papered over: hosted generation is already
accepted as non-reproducible ([SPEC.md](SPEC.md)), and this is one of the reasons.

**Which model answered is read back, not assumed.** SPEC's pinning rule expects a
withdrawn model to fail loudly and fall through. DeepSeek retires models differently: it
routes the retired name to a successor and answers with HTTP 200, so nothing fails, and a
regeneration would store the retired model's name against another model's prose. Every
provider here names the model that actually answered, so each response is checked against
the requested ref and a mismatch is recorded as a substitution (Milestone 22).
"""

from __future__ import annotations

import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Any

import httpx

from hip.config import CandidateModel, Cohort, EvalLimits, SamplingParams
from hip.eval.normalize import split_reasoning
from hip.eval.runners.base import RunnerUnavailable
from hip.eval.types import Generation, Scenario, Telemetry

log = logging.getLogger(__name__)

# Shorter than the local runners' 600s. A hosted provider that has not answered in two
# minutes is not thinking, it is wedged, and the retry below is the cheaper recovery.
_TIMEOUT = httpx.Timeout(120.0, connect=10.0)

# Retried because they are transient by definition: 429 is the provider asking for less
# concurrency, and 5xx is its problem rather than the prompt's. A 400 or a 401 is not
# retried — the request is wrong, and repeating it wastes the run's wall clock while
# producing the same answer.
_RETRY_STATUS = frozenset({408, 409, 429, 500, 502, 503, 504})
_MAX_ATTEMPTS = 4
_BACKOFF_BASE_S = 1.0
_BACKOFF_CAP_S = 30.0

# Greedy, so a probe measures reachability rather than sampling.
_PROBE_SAMPLING = SamplingParams(
    temperature=0.0, top_p=1.0, top_k=1, repeat_penalty=1.0, seed=0
)

# How each dialect says a generation stopped because it ran out of budget. A reasoning
# model that stops this way with no answer was cut off mid-thought — a different finding
# from a model that declined — and DeepSeek reasons in a separate field that the
# tag-based check in `split_reasoning` never reads.
_CUTOFF_REASONS = frozenset({"length", "MAX_TOKENS"})


@dataclass(frozen=True)
class _Dialect:
    """The parts of a provider's HTTP surface that are not shared.

    `usage_path` names where the token counters live: OpenAI-compatible providers put
    them under `usage.prompt_tokens` / `usage.completion_tokens`, while Gemini reports
    `usageMetadata.promptTokenCount` / `candidatesTokenCount`.
    """

    chat_path: str
    models_path: str
    auth_header: str
    auth_prefix: str
    openai_compatible: bool = True


_DIALECTS: dict[str, _Dialect] = {
    # DeepSeek and Mistral both serve an OpenAI-shaped chat completions endpoint as
    # their primary API, so neither needs a compatibility shim to reach it.
    "deepseek": _Dialect(
        chat_path="/chat/completions",
        models_path="/models",
        auth_header="Authorization",
        auth_prefix="Bearer ",
    ),
    "mistral": _Dialect(
        chat_path="/chat/completions",
        models_path="/models",
        auth_header="Authorization",
        auth_prefix="Bearer ",
    ),
    # Gemini's native `generateContent` rather than its OpenAI compatibility layer.
    # The compatibility layer is a translation maintained for other people's clients:
    # it is the surface most likely to lag a model launch or to drop a field, and a
    # field it drops here is a token counter that the cost column depends on.
    "gemini": _Dialect(
        chat_path="/models/{ref}:generateContent",
        models_path="/models",
        auth_header="x-goog-api-key",
        auth_prefix="",
        openai_compatible=False,
    ),
}


class HostedRunner:
    """Implements `ModelRunner` over one hosted provider's chat endpoint."""

    def __init__(self, cohort: Cohort, name: str) -> None:
        if cohort.provider is None or cohort.api_key_env is None or not cohort.endpoint:
            # Unreachable through config, which validates this at load. Kept because the
            # class is constructible directly in tests and a None here would surface far
            # away as a TypeError inside httpx.
            raise RunnerUnavailable(
                f"cohort '{name}' is hosted but declares no provider, api_key_env, or "
                f"endpoint"
            )
        self._cohort = name
        self._provider = cohort.provider
        self._endpoint = cohort.endpoint.rstrip("/")
        self._api_key_env = cohort.api_key_env
        self._dialect = _DIALECTS[cohort.provider]

    @property
    def provider(self) -> str:
        return self._provider

    def _api_key(self) -> str | None:
        return os.environ.get(self._api_key_env)

    def available(self) -> bool:
        """Whether this provider can currently be called.

        A missing key is *unavailability*, not a configuration error. That distinction
        is the whole preference list: a tier without a key falls through to the next one
        exactly as a withdrawn model does, and `hip explain` keeps running. Checked
        without a network call, because an absent key cannot be fixed by asking the
        provider about it.
        """
        return bool(self._api_key())

    def served_models(self) -> set[str]:
        """Model identifiers the provider actually serves right now.

        The reason `hip eval models` can verify a pin rather than trust one. A ref that
        does not appear here is withdrawn or misspelled, and both should be found before
        a run rather than as 15 identical 404s inside one.
        """
        key = self._api_key()
        if not key:
            raise RunnerUnavailable(
                f"{self._provider} needs {self._api_key_env}, which is not set "
                f"(see .env.example)."
            )
        try:
            response = httpx.get(
                f"{self._endpoint}{self._dialect.models_path}",
                headers=self._headers(key),
                timeout=15.0,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RunnerUnavailable(
                f"{self._provider} is not reachable at {self._endpoint} ({exc})."
            ) from exc
        payload = response.json()
        entries = payload.get("data") or payload.get("models") or []
        served: set[str] = set()
        for entry in entries:
            identifier = str(entry.get("id") or entry.get("name") or "")
            # Gemini returns fully-qualified names (`models/gemini-2.5-flash-lite`);
            # the config pins the bare ref, which is what the caller compares against.
            served.add(identifier.split("/")[-1])
        return served

    def probe(self, model: CandidateModel) -> str | None:
        """Call `model` once with a trivial prompt. Returns None on success.

        `served_models` asks what the provider lists, which turns out not to be the
        same question as what it will answer. On 2026-09-06 `gemini-2.5-flash-lite`
        appeared in the listing and advertised `generateContent`, and calling it
        returned 404 "no longer available to new users" — grandfathered for older keys.
        A listing check cannot see that; only a call can.

        Costs a few tokens per candidate, which is why it is opt-in rather than part of
        `available()`. Finding a dead pin here costs a fraction of a cent; finding it
        during a run costs fifteen generations and the judging batch behind them.

        It checks *which* model answered before *whether* one did. A routed pin — a
        retired name the provider quietly answers with a successor — returns a perfectly
        good answer, and "text came back" is exactly the test routing passes.
        """
        key = self._api_key()
        if not key:
            return f"{self._api_key_env} is not set"
        probe_limits = EvalLimits(context_tokens=2048, max_output_tokens=256)
        body = self._body(model, "Reply with exactly: OK", _PROBE_SAMPLING, probe_limits)
        try:
            response = httpx.post(
                self._url(model),
                json=body,
                headers=self._headers(key),
                timeout=httpx.Timeout(30.0, connect=10.0),
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = ""
            try:
                payload = exc.response.json()
                detail = str(payload.get("error", {}).get("message") or "")[:120]
            except ValueError:
                detail = exc.response.text[:120]
            return f"HTTP {exc.response.status_code}: {detail}" if detail else str(exc)
        except httpx.HTTPError as exc:
            return str(exc)
        data = dict(response.json())
        served, _ = self._served(data)
        substitution = self._substitution(model, served)
        if substitution:
            return substitution
        text, _, finish = self._extract(data)
        if text.strip():
            return None
        # A reasoning model can spend a probe's small budget thinking and stop before the
        # answer. It is the right model and it responded, which is what a probe asks.
        return None if finish in _CUTOFF_REASONS else "returned no text"

    def _headers(self, key: str) -> dict[str, str]:
        return {
            self._dialect.auth_header: f"{self._dialect.auth_prefix}{key}",
            "Content-Type": "application/json",
        }

    def _body(
        self,
        model: CandidateModel,
        prompt: str,
        sampling: SamplingParams,
        limits: EvalLimits,
    ) -> dict[str, Any]:
        if self._dialect.openai_compatible:
            return {
                "model": model.ref,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "temperature": sampling.temperature,
                "top_p": sampling.top_p,
                "max_tokens": limits.max_output_tokens,
            }
        return {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": sampling.temperature,
                "topP": sampling.top_p,
                "maxOutputTokens": limits.max_output_tokens,
            },
        }

    def _url(self, model: CandidateModel) -> str:
        return f"{self._endpoint}{self._dialect.chat_path.format(ref=model.ref)}"

    def generate(
        self,
        model: CandidateModel,
        scenario: Scenario,
        prompt: str,
        sampling: SamplingParams,
        limits: EvalLimits,
        mode: str,
        repeat: int,
        seed: int | None,
    ) -> Generation:
        started = time.perf_counter()
        key = self._api_key()
        if not key:
            return self._failed(
                model,
                scenario,
                mode,
                repeat,
                f"{self._api_key_env} is not set",
                started,
            )

        try:
            data = self._post_with_retry(model, prompt, sampling, limits, key)
        except httpx.HTTPError as exc:
            log.warning("%s generation failed for %s: %s", self._provider, model.id, exc)
            return self._failed(model, scenario, mode, repeat, str(exc), started)

        raw, reasoning_text, finish = self._extract(data)
        answer, reasoning, truncated = split_reasoning(raw, reasoning_text)
        # Cut off by the budget before any answer arrived. The tag-based check above
        # cannot see this when reasoning comes in its own field, as DeepSeek's does:
        # three empty `v2` answers spent all 6,000 tokens reasoning and still reported
        # `truncated_reasoning=False`.
        truncated = truncated or (finish in _CUTOFF_REASONS and not answer.strip())
        prompt_tokens, generation_tokens, reasoning_tokens = self._usage(data)
        served_model, fingerprint = self._served(data)
        elapsed_ms = (time.perf_counter() - started) * 1000

        telemetry = Telemetry(
            prompt_tokens=prompt_tokens,
            generation_tokens=generation_tokens,
            reasoning_tokens=reasoning_tokens,
            # No provider in this set reports a first-token timestamp on a
            # non-streaming call, and deriving one from the wall clock would report
            # network latency as though it were the model's.
            ttft_ms=None,
            # Wall clock, which for a hosted call includes the network. Named the same
            # as the local runners' figure but not the same quantity, and the report
            # must not rank a hosted model against a local one on it.
            generation_ms=elapsed_ms,
            total_ms=elapsed_ms,
            load_ms=None,
            tokens_per_second=(
                generation_tokens / (elapsed_ms / 1000) if elapsed_ms > 0 else None
            ),
            peak_memory_mb=None,
            memory_basis=None,
            finish_reason=finish,
            served_model=served_model,
            system_fingerprint=fingerprint,
        )

        substitution = self._substitution(model, served_model)
        if substitution:
            # Paid for, and recorded as such — the tokens stay on the telemetry, so the
            # cost column sees them — but the text is never used as an answer. It was
            # written by a model nobody benchmarked, and the row would carry the name of
            # one that did not write it.
            log.warning(
                "%s substituted a model for %s: %s",
                self._provider,
                model.id,
                substitution,
            )
            return Generation(
                scenario_key=scenario.key,
                scenario_id=scenario.scenario_id,
                region_id=scenario.region_id,
                model_id=model.id,
                cohort=self._cohort,
                mode=mode,  # type: ignore[arg-type]
                repeat=repeat,
                answer="",
                raw=raw,
                telemetry=telemetry,
                error=substitution,
            )

        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort=self._cohort,
            mode=mode,  # type: ignore[arg-type]
            repeat=repeat,
            answer=answer,
            reasoning=reasoning,
            truncated_reasoning=truncated,
            raw=raw,
            telemetry=telemetry,
        )

    def _post_with_retry(
        self,
        model: CandidateModel,
        prompt: str,
        sampling: SamplingParams,
        limits: EvalLimits,
        key: str,
    ) -> dict[str, Any]:
        """POST the generation, retrying only what is worth retrying.

        Exponential backoff with full jitter. Jitter rather than a flat doubling because
        a bounded fan-out that hits a rate limit hits it in a group, and an unjittered
        backoff marches the whole group into the next wall together.

        `Retry-After` wins over the computed delay when the provider sends one: it is
        the only party that knows when the limit clears.
        """
        url = self._url(model)
        body = self._body(model, prompt, sampling, limits)
        headers = self._headers(key)
        last: httpx.HTTPError | None = None

        for attempt in range(_MAX_ATTEMPTS):
            try:
                response = httpx.post(url, json=body, headers=headers, timeout=_TIMEOUT)
                response.raise_for_status()
                return dict(response.json())
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in _RETRY_STATUS:
                    raise
                last = exc
                delay = self._retry_delay(
                    attempt, exc.response.headers.get("retry-after")
                )
            except httpx.HTTPError as exc:
                # Connection and read errors: transient in the same way a 503 is.
                last = exc
                delay = self._retry_delay(attempt, None)

            if attempt == _MAX_ATTEMPTS - 1:
                break
            log.info(
                "%s %s: attempt %d/%d failed, retrying in %.1fs",
                self._provider,
                model.id,
                attempt + 1,
                _MAX_ATTEMPTS,
                delay,
            )
            time.sleep(delay)

        assert last is not None
        raise last

    @staticmethod
    def _retry_delay(attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return min(float(retry_after), _BACKOFF_CAP_S)
            except ValueError:
                # `Retry-After` may be an HTTP date rather than seconds. Falling through
                # to the computed backoff is better than parsing a date format to
                # decide how long to sleep.
                pass
        ceiling = min(_BACKOFF_BASE_S * (2**attempt), _BACKOFF_CAP_S)
        return random.uniform(0.0, ceiling)  # noqa: S311 - jitter, not cryptography

    def _extract(self, data: dict[str, Any]) -> tuple[str, str | None, str]:
        """The answer text, any separate reasoning channel, and the finish reason."""
        if self._dialect.openai_compatible:
            choices = data.get("choices") or []
            if not choices:
                return "", None, "no_choices"
            message = choices[0].get("message") or {}
            # DeepSeek returns thinking under `reasoning_content` on its reasoning
            # modes. Kept separate from the answer for the same reason the local
            # runners split it: a reasoning model would otherwise be graded on text its
            # author never meant a reader to see.
            reasoning = message.get("reasoning_content") or message.get("reasoning")
            return (
                str(message.get("content") or ""),
                str(reasoning) if reasoning else None,
                str(choices[0].get("finish_reason") or ""),
            )

        candidates = data.get("candidates") or []
        if not candidates:
            # A blocked prompt returns no candidate and a `promptFeedback` block. It is
            # a refusal, and reporting it as an empty answer would let the refusal
            # scenario score a model that never saw the question.
            blocked = (data.get("promptFeedback") or {}).get("blockReason")
            return "", None, f"blocked:{blocked}" if blocked else "no_candidates"
        candidate = candidates[0]
        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(str(part.get("text") or "") for part in parts)
        return text, None, str(candidate.get("finishReason") or "")

    def _usage(self, data: dict[str, Any]) -> tuple[int, int, int]:
        """Prompt, generation, and reasoning token counts.

        These are the provider's own counters rather than an estimate, which matters
        more here than locally: they are what the bill is computed from, so the cost
        column is derived from the same numbers the invoice is.
        """
        if self._dialect.openai_compatible:
            usage = data.get("usage") or {}
            details = usage.get("completion_tokens_details") or {}
            return (
                int(usage.get("prompt_tokens") or 0),
                int(usage.get("completion_tokens") or 0),
                int(details.get("reasoning_tokens") or 0),
            )
        usage = data.get("usageMetadata") or {}
        # `candidatesTokenCount` counts the answer only; Gemini reports thinking
        # separately in `thoughtsTokenCount` and bills both at the output rate. The
        # OpenAI-shaped providers use the opposite convention — `completion_tokens`
        # already includes `reasoning_tokens` — and Ollama's `eval_count` covers both
        # as well. Three conventions, one column: `generation_tokens` means every token
        # billed as output, everywhere, so the cost column and the invoice agree and
        # `reasoning_share` cannot exceed 100%.
        #
        # Found 2026-09-06 by a 237% reasoning share on `gemini-3.7-flash` in run `v2`,
        # which also meant its cost was under-reported by 58% — on the candidate the
        # run selected.
        thoughts = int(usage.get("thoughtsTokenCount") or 0)
        return (
            int(usage.get("promptTokenCount") or 0),
            int(usage.get("candidatesTokenCount") or 0) + thoughts,
            thoughts,
        )

    def _served(self, data: dict[str, Any]) -> tuple[str | None, str | None]:
        """The model the provider says answered, and its backend fingerprint if sent.

        Read from the response rather than assumed from the request, because the two can
        differ: DeepSeek retires a model by routing its name to a successor, and the only
        honest record of which model wrote a paragraph is the one the provider returns.
        OpenAI-shaped providers report it as `model`, Gemini as `modelVersion`.
        """
        if self._dialect.openai_compatible:
            served = data.get("model")
            fingerprint = data.get("system_fingerprint")
        else:
            served = data.get("modelVersion")
            fingerprint = None
        return (
            str(served) if served else None,
            str(fingerprint) if fingerprint else None,
        )

    def _substitution(self, model: CandidateModel, served: str | None) -> str | None:
        """Why this response cannot be attributed to `model`, or None if it can.

        Exact match only. Measured 2026-09-10, every current candidate reports exactly
        its requested ref, so a difference is a substitution rather than a formatting
        quirk — and if a provider ever starts reporting an expanded version string, the
        mismatch fails in the safe direction: loudly, naming both, and falling through,
        rather than storing one model's prose under another's name. A response that names
        no model cannot be checked and is accepted, since failing it would make every
        provider that omits the field unusable.
        """
        if served is None or served == model.ref:
            return None
        return (
            f"substitution: requested '{model.ref}' but {self._provider} answered with "
            f"'{served}'. The provider is routing a retired or repointed model; update "
            f"the pin rather than publish prose under the wrong name."
        )

    def _failed(
        self,
        model: CandidateModel,
        scenario: Scenario,
        mode: str,
        repeat: int,
        error: str,
        started: float,
    ) -> Generation:
        elapsed = (time.perf_counter() - started) * 1000
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort=self._cohort,
            mode=mode,  # type: ignore[arg-type]
            repeat=repeat,
            answer="",
            raw="",
            telemetry=Telemetry(
                prompt_tokens=0,
                generation_tokens=0,
                generation_ms=0.0,
                total_ms=elapsed,
            ),
            error=error,
        )
