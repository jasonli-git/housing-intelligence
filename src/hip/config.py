"""Settings and YAML configuration loading.

Importable from any module (see the dependency rule in ARCHITECTURE.md). Environment
supplies secrets and machine-local paths; the three YAML files under ``config/`` supply
everything a reader would want to see in version control: which sources exist, which
geographies are in scope (ARCHITECTURE #14), and what each metric means.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

RegionLevel = Literal["state", "county", "municipality", "zip", "tract", "parcel"]
Cadence = Literal["monthly", "quarterly", "annual", "irregular"]
Direction = Literal["higher_is_better", "lower_is_better", "neutral"]

REPO_ROOT = Path(__file__).resolve().parents[2]

# ${VAR} or ${VAR:-fallback}
_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")

# Static federal reference data, not scope. Lives here because `hip.sources` needs it to
# build per-state download URLs and may not import `hip.geography` (the dependency rule
# runs one way). All 50 states plus DC and PR, so expanding scope never needs a code
# change — only an edit to config/geography.yml (#14).
STATE_FIPS: dict[str, str] = {
    "AL": "01",
    "AK": "02",
    "AZ": "04",
    "AR": "05",
    "CA": "06",
    "CO": "08",
    "CT": "09",
    "DE": "10",
    "DC": "11",
    "FL": "12",
    "GA": "13",
    "HI": "15",
    "ID": "16",
    "IL": "17",
    "IN": "18",
    "IA": "19",
    "KS": "20",
    "KY": "21",
    "LA": "22",
    "ME": "23",
    "MD": "24",
    "MA": "25",
    "MI": "26",
    "MN": "27",
    "MS": "28",
    "MO": "29",
    "MT": "30",
    "NE": "31",
    "NV": "32",
    "NH": "33",
    "NJ": "34",
    "NM": "35",
    "NY": "36",
    "NC": "37",
    "ND": "38",
    "OH": "39",
    "OK": "40",
    "OR": "41",
    "PA": "42",
    "RI": "44",
    "SC": "45",
    "SD": "46",
    "TN": "47",
    "TX": "48",
    "UT": "49",
    "VT": "50",
    "VA": "51",
    "WA": "53",
    "WV": "54",
    "WI": "55",
    "WY": "56",
    "PR": "72",
}


def fips_for(state_code: str) -> str:
    """FIPS code for a two-letter state code, or a ConfigError naming the bad value."""
    try:
        return STATE_FIPS[state_code.upper()]
    except KeyError:
        raise ConfigError(
            f"geography.yml: scope.states: '{state_code}' is not a known state code"
        ) from None


class ConfigError(Exception):
    """Raised when a config file is missing, malformed, or fails validation.

    The message always names the file and the key path, so a typo in a 200-line YAML
    file does not turn into a hunt.
    """


class Settings(BaseSettings):
    """Machine-local settings. Secrets and paths only — never product configuration."""

    model_config = SettingsConfigDict(env_prefix="HIP_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://hip:hip@localhost:5432/hip"
    data_dir: Path = REPO_ROOT / "data"
    config_dir: Path = REPO_ROOT / "config"
    # Human-facing output — validation reports and region reports. Beside `data/` rather
    # than inside it: these are meant to be read, shared, and in the case of the 21
    # county reports committed, while everything under `data/` is a rebuildable machine
    # artifact (ARCHITECTURE #10).
    #
    # Its own setting rather than a path derived from `data_dir`, which is what it was
    # until 2026-09-01. Deriving it as `data_dir.parent / "reports"` produced the right
    # answer only while `data_dir` sat inside the repo: pointing HIP_DATA_DIR at an
    # external volume silently moved `reports/` there too, taking the git-tracked county
    # reports and the README's links to them off the repo entirely (#65). The default
    # here is byte-identical to what that expression returned, so nothing moves for
    # anyone who does not set the variable.
    reports_dir: Path = REPO_ROOT / "reports"

    @field_validator("data_dir", "config_dir", "reports_dir")
    @classmethod
    def _expand(cls, value: Path) -> Path:
        """Expand `~` and resolve, so a hand-written .env path behaves like a shell one.

        Pydantic parses `Path` without touching `~`, which would otherwise create a
        directory literally named `~` in the repo root the first time a stage ran.
        """
        return value.expanduser().resolve()

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def parquet_dir(self) -> Path:
        return self.data_dir / "parquet"

    @property
    def duckdb_path(self) -> Path:
        return self.data_dir / "duckdb" / "hip.duckdb"

    @property
    def packets_dir(self) -> Path:
        return self.data_dir / "packets"


class Source(BaseModel):
    """One public data source. ``adapter`` is resolved at Milestone 2."""

    model_config = ConfigDict(extra="forbid")

    name: str
    publisher: str
    license: str
    # Canonical root, and what the packet carries. For a source fetched over an API this
    # is the API root, which is the right answer for provenance and the wrong one for a
    # person: `https://api.census.gov/data` returns JSON, and `api.bls.gov/publicAPI/v2`
    # returns a 404 to a browser.
    url: str
    # Where a reader should be sent instead, when those differ. Optional because for most
    # sources they do not — `census.gov/construction/bps/` is both. Defaults to `url`.
    homepage: str | None = None
    cadence: Cadence
    adapter: str
    api_key_env: str | None = None
    notes: str | None = None


class Metric(BaseModel):
    """One metric definition. Mirrors the ``metrics`` warehouse table."""

    model_config = ConfigDict(extra="forbid")

    label: str
    unit: str
    frequency: Cadence
    direction: Direction
    description: str
    source_id: str


class GeographyScope(BaseModel):
    """Which geographies the pipeline is allowed to load (ARCHITECTURE #14)."""

    model_config = ConfigDict(extra="forbid")

    states: list[str] = Field(min_length=1)
    levels: list[RegionLevel] = Field(min_length=1)
    municipality_id_system: Literal["census_mcd", "nj_municipal_code"]


class SamplingParams(BaseModel):
    """One pinned sampling configuration, applied identically to every runtime.

    Stated in full rather than partially because the two runtimes disagree on defaults:
    MLX-LM is greedy at temperature 0.0, while Ollama applies temp 0.8 / top_p 0.9 /
    top_k 40 / repeat_penalty 1.1 for models that ship no parameters of their own. A
    field left unset here would silently mean two different things per cohort.
    """

    model_config = ConfigDict(extra="forbid")

    temperature: float = Field(ge=0.0, le=2.0)
    top_p: float = Field(ge=0.0, le=1.0)
    top_k: int = Field(ge=1)
    repeat_penalty: float = Field(gt=0.0)
    seed: int | None = None


class SamplingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deterministic: SamplingParams
    stability: SamplingParams


class EvalLimits(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context_tokens: int = Field(ge=2048)
    max_output_tokens: int = Field(ge=256)
    keep_alive: int = 0


# The reasoning a candidate is asked for (Milestone 20). `default` sends no control and
# leaves the decision to the provider, which is what every run before Milestone 20 did;
# any other value is sent as that provider's own documented control by its dialect in
# `hip.eval.runners.hosted`.
#
# Two values beyond the default, each the lowest setting its provider has been seen to
# accept, and the only ones a candidate uses. `disabled` is a hard off (DeepSeek's
# `thinking.type`) and makes a claim the report checks: no reasoning tokens. `low` is
# Gemini 3.7 Flash's lowest accepted `thinkingLevel` and claims only a level. Others are
# additive and deliberately absent until something measures them: a value config
# accepts but no model has been seen to honour is the same unverified claim as a pin
# copied from a blog. `minimal` was exactly that — documented for Gemini 3 Flash, and
# refused by 3.7 Flash with HTTP 400 on 2026-09-10.
ReasoningEffort = Literal["default", "disabled", "low"]

# Which settings each hosted provider can express. The wire format lives beside each
# dialect in `hip.eval.runners.hosted`; this is what config validates against at load,
# and a test holds the two in agreement.
#
# Declared per provider rather than per model, which is an approximation: a provider's
# models do not all accept the same levels, as `minimal` showed. A model that refuses a
# setting its provider offers answers HTTP 400, which `hip eval models --probe`
# surfaces before a run.
#
# Mistral is `default` only. Its control is `reasoning_effort` `none` | `high`, and
# `high` turns `message.content` from a string into a list of thinking and text chunks,
# which the OpenAI-shaped parser would stringify into a Python repr and grade as the
# answer. `v2` measured no reasoning from either Mistral candidate at the default, so a
# `none` variant would re-measure one configuration under a second id.
REASONING_CONTROLS: dict[str, frozenset[str]] = {
    "deepseek": frozenset({"default", "disabled"}),
    "gemini": frozenset({"default", "low"}),
    "mistral": frozenset({"default"}),
}


class CandidateModel(BaseModel):
    """One model under test. ``anchor`` pairs it with its counterpart in the other
    cohort, which is what licenses any cross-runtime comparison.

    Token rates are per candidate rather than per provider because a provider's tiers
    differ by an order of magnitude, and the quality-per-dollar column compares
    candidates. They stay ``None`` for a local model: a local generation is not free,
    it is simply not billed per token, and writing 0.0 would put a misleading zero in a
    published cost column instead of an honest blank.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    ref: str
    label: str
    quantization: str
    anchor: str | None = None
    input_usd_per_mtok: float | None = Field(default=None, ge=0.0)
    output_usd_per_mtok: float | None = Field(default=None, ge=0.0)
    # Part of the candidate's identity rather than a runtime option. `v2` compared seven
    # models each at its vendor's default, and DeepSeek's default is thinking at high
    # effort, so part of what it measured was how much each vendor reasons when nobody
    # asks. A different setting is a different configuration and gets its own id:
    # flipping this on a benchmarked candidate in place would publish prose from a
    # configuration nobody measured, which `hip.eval.selection` refuses.
    reasoning_effort: ReasoningEffort = "default"

    @property
    def billed_per_token(self) -> bool:
        return self.input_usd_per_mtok is not None or self.output_usd_per_mtok is not None

    def usd_for(self, prompt_tokens: int, generation_tokens: int) -> float | None:
        """What one generation cost, or ``None`` when the candidate is not billed."""
        if not self.billed_per_token:
            return None
        return (
            prompt_tokens * (self.input_usd_per_mtok or 0.0)
            + generation_tokens * (self.output_usd_per_mtok or 0.0)
        ) / 1_000_000


class Cohort(BaseModel):
    """One runtime and the candidates it serves.

    ``provider`` names the request and response dialect rather than the vendor as a
    brand: three hosted providers sit behind one ``HostedRunner``, and what differs
    between them is auth header, path, and where the usage counters live in the
    response. ``api_key_env`` names the variable rather than carrying the key, which is
    the same rule the source adapters follow and the reason a key has never reached a
    manifest (ARCHITECTURE #76).
    """

    model_config = ConfigDict(extra="forbid")

    runner: Literal["ollama", "mlx", "hosted"]
    provider: Literal["deepseek", "gemini", "mistral"] | None = None
    api_key_env: str | None = None
    endpoint: str | None = None
    models: list[CandidateModel] = Field(min_length=1)
    # Overrides `limits` for `hip explain` only, never for the evaluation.
    #
    # The distinction is the point. `limits` is an *evaluation* budget: every candidate
    # is compared under one ceiling, and holding it common is what makes the comparison
    # mean anything, so a per-cohort override there would quietly invalidate the
    # benchmark. Generation asks a different question — can this model, on this runtime,
    # finish a paragraph — and the answer is a property of the runtime. A 12,288-token
    # window is Gemma's on this machine; DeepSeek and Gemini have an order of magnitude
    # more, and reserving output inside the local figure is arithmetic about the wrong
    # hardware.
    #
    # Measured 2026-09-06: `deepseek-v4-pro` spent the whole 6,000-token evaluation
    # budget on reasoning and returned nothing for 12 of 21 counties, then completed the
    # same packet in 6,985.
    generation_limits: EvalLimits | None = None

    @model_validator(mode="after")
    def _hosted_needs_credentials(self) -> Cohort:
        """A hosted cohort is unusable without a dialect and a key, and a local one has
        no use for either. Both directions are errors rather than ignored fields, so a
        stray `provider:` on the Ollama cohort fails at config load instead of being
        silently discarded."""
        if self.runner == "hosted":
            missing = [
                name
                for name, value in (
                    ("provider", self.provider),
                    ("api_key_env", self.api_key_env),
                    ("endpoint", self.endpoint),
                )
                if not value
            ]
            if missing:
                raise ValueError(f"a hosted cohort requires {', '.join(missing)}")
        elif self.provider or self.api_key_env:
            raise ValueError(
                f"runner '{self.runner}' is local; provider and api_key_env apply "
                f"only to a hosted cohort"
            )
        return self

    @model_validator(mode="after")
    def _reasoning_is_expressible(self) -> Cohort:
        """A setting the runner cannot send would be dropped on the floor, and the run
        would record an answer against a configuration that never reached the model.
        Both ways that can happen fail at load instead: a local runner sends no reasoning
        control at all, and a hosted provider offers only what `REASONING_CONTROLS`
        declares."""
        for candidate in self.models:
            effort = candidate.reasoning_effort
            if effort == "default":
                continue
            if self.runner != "hosted":
                raise ValueError(
                    f"model '{candidate.id}' sets reasoning_effort '{effort}', but "
                    f"runner '{self.runner}' is local and sends no reasoning control"
                )
            offered = REASONING_CONTROLS.get(self.provider or "", frozenset({"default"}))
            if effort not in offered:
                raise ValueError(
                    f"model '{candidate.id}' sets reasoning_effort '{effort}', which "
                    f"provider '{self.provider}' does not offer "
                    f"(offered: {', '.join(sorted(offered))})"
                )
        return self


class EvalScenario(BaseModel):
    """One question asked of every model against every sampled packet."""

    model_config = ConfigDict(extra="forbid")

    id: str
    question: str
    grounds: list[str] = Field(default_factory=list)
    expects_refusal: bool = False


class RubricCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    weight: float = Field(gt=0.0)
    description: str


class Rubric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criteria: list[RubricCriterion] = Field(min_length=1)


class JudgeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    mode: Literal["batch", "sync"] = "batch"
    max_tokens: int = Field(ge=1024)
    effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"


class GenerationConfig(BaseModel):
    """How `hip explain` chooses a model, and how hard it may push a provider.

    The preference list is a durability mechanism rather than a tuning knob
    ([SPEC.md](SPEC.md)): it resolves at generation time to the first available
    candidate and ends at the local runtime, so no vendor decision can stop `hip
    explain` from running. Two rules keep it from becoming a back door around the
    evaluation — every entry must be a declared candidate (checked at config load) and
    must have passed the benchmark (checked at resolution, where the run results are).

    `max_concurrency` bounds in-flight requests per cohort. Hosted inference is on this
    milestone for concurrency, but an unbounded fan-out earns 429s that look like model
    failures, and the retry that follows costs more wall-clock than the parallelism
    saved.
    """

    model_config = ConfigDict(extra="forbid")

    preference: list[str] = Field(min_length=1)
    max_concurrency: int = Field(default=4, ge=1, le=32)


class EvaluationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sampling: SamplingConfig
    limits: EvalLimits
    cohorts: dict[str, Cohort] = Field(min_length=1)
    generation: GenerationConfig
    system_prompt: str
    scenarios: list[EvalScenario] = Field(min_length=1)
    rubric: Rubric
    judge: JudgeConfig

    @property
    def models(self) -> list[CandidateModel]:
        """Every candidate across every cohort, in declaration order."""
        return [m for cohort in self.cohorts.values() for m in cohort.models]

    def cohort_of(self, model_id: str) -> str:
        for name, cohort in self.cohorts.items():
            if any(m.id == model_id for m in cohort.models):
                return name
        raise ConfigError(f"evaluation.yml: no cohort declares model '{model_id}'")

    def model(self, model_id: str) -> CandidateModel:
        for candidate in self.models:
            if candidate.id == model_id:
                return candidate
        raise ConfigError(f"evaluation.yml: no model '{model_id}'")

    def cohort_for(self, model_id: str) -> Cohort:
        """The cohort object serving a model, not just its name."""
        return self.cohorts[self.cohort_of(model_id)]


class SourcesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: dict[str, Source] = Field(min_length=1)


class MetricsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metrics: dict[str, Metric] = Field(min_length=1)


class GeographyConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: GeographyScope


def _resolve_env(value: Any, key_path: str, filename: str) -> Any:
    """Recursively substitute ``${VAR}`` / ``${VAR:-default}`` in string leaves."""
    if isinstance(value, dict):
        return {
            k: _resolve_env(v, f"{key_path}.{k}" if key_path else str(k), filename)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [
            _resolve_env(v, f"{key_path}[{i}]", filename) for i, v in enumerate(value)
        ]
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        var, default = match.group(1), match.group(2)
        env_value = os.environ.get(var)
        if env_value is not None:
            return env_value
        if default is not None:
            return default
        raise ConfigError(
            f"{filename}: {key_path}: environment variable {var} is not set "
            f"and no default was given (write ${{{var}:-fallback}} to allow one)"
        )

    return _ENV_PATTERN.sub(replace, value)


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ConfigError(f"{path}: no such config file")
    try:
        raw = yaml.safe_load(path.read_text())
    except yaml.YAMLError as exc:
        raise ConfigError(f"{path}: invalid YAML: {exc}") from exc
    if not isinstance(raw, dict):
        raise ConfigError(f"{path}: expected a mapping at the top level")
    resolved = _resolve_env(raw, "", path.name)
    assert isinstance(resolved, dict)
    return resolved


def _validate[T: BaseModel](model: type[T], data: dict[str, Any], path: Path) -> T:
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        )
        raise ConfigError(f"{path}: {problems}") from exc


@lru_cache(maxsize=1)
def load_env_file(path: Path | None = None) -> int:
    """Load `.env` into the process environment. Returns how many names were set.

    `Settings` reads `.env` for its own `HIP_`-prefixed fields, but pydantic-settings
    does not export anything else into `os.environ` — so the source API keys, which are
    read with `os.environ.get()` (`_resolve_env`, `check_config`, and the judge), never
    saw a `.env` at all. Every key had to be exported by hand while `.env.example` and
    the error messages both said to put it in `.env`. The documentation was not wrong
    about where keys belong; the loader was missing.

    Real values already in the environment win, so an explicit `export` still overrides
    the file and CI can inject secrets without a `.env` present.
    """
    from dotenv import dotenv_values

    env_path = path or (REPO_ROOT / ".env")
    if not env_path.exists():
        return 0
    loaded = 0
    for key, value in dotenv_values(env_path).items():
        if value is not None and key not in os.environ:
            os.environ[key] = value
            loaded += 1
    return loaded


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def load_sources(config_dir: Path | None = None) -> dict[str, Source]:
    path = (config_dir or get_settings().config_dir) / "sources.yml"
    return _validate(SourcesConfig, _load_yaml(path), path).sources


def load_metrics(config_dir: Path | None = None) -> dict[str, Metric]:
    path = (config_dir or get_settings().config_dir) / "metrics.yml"
    return _validate(MetricsConfig, _load_yaml(path), path).metrics


def load_geography(config_dir: Path | None = None) -> GeographyScope:
    path = (config_dir or get_settings().config_dir) / "geography.yml"
    return _validate(GeographyConfig, _load_yaml(path), path).scope


def load_evaluation(config_dir: Path | None = None) -> EvaluationConfig:
    """The Milestone 8 evaluation plan. Only `hip eval` and `hip explain` read this."""
    path = (config_dir or get_settings().config_dir) / "evaluation.yml"
    return _validate(EvaluationConfig, _load_yaml(path), path)


def _duplicates(values: list[str]) -> list[str]:
    return sorted({v for v in values if values.count(v) > 1})


def _check_evaluation(config_dir: Path | None) -> list[str]:
    """Cross-check evaluation.yml, when the checkout has one.

    Unlike the other three files this one is not load-bearing for the pipeline — only
    `hip eval` and `hip explain` read it — so its absence must not stop `hip acquire`.
    A file that exists and is wrong is still an error; both of those commands fail
    loudly on a missing file, which covers the misspelled-filename case.
    """
    path = (config_dir or get_settings().config_dir) / "evaluation.yml"
    if not path.exists():
        return []

    return evaluation_problems(load_evaluation(config_dir))


def evaluation_problems(evaluation: EvaluationConfig) -> list[str]:
    """Every cross-reference problem in a loaded evaluation plan.

    Separate from the file handling above, so a plan can be checked without writing it
    to disk first.
    """
    problems = [
        f"evaluation.yml: duplicate model id '{dup}'"
        for dup in _duplicates([m.id for m in evaluation.models])
    ]
    problems += [
        f"evaluation.yml: duplicate scenario id '{dup}'"
        for dup in _duplicates([s.id for s in evaluation.scenarios])
    ]
    problems += [
        f"evaluation.yml: duplicate rubric criterion '{dup}'"
        for dup in _duplicates([c.id for c in evaluation.rubric.criteria])
    ]

    # A second id for one configuration splits that configuration's evidence across two
    # rows and invites a reader to compare a model with itself. The way to get here is a
    # variant copied from its base and left at the base's reasoning effort.
    for cohort_name, cohort in evaluation.cohorts.items():
        first: dict[tuple[str, str], str] = {}
        for candidate in cohort.models:
            key = (candidate.ref, candidate.reasoning_effort)
            if key in first:
                problems.append(
                    f"evaluation.yml: '{first[key]}' and '{candidate.id}' in cohort "
                    f"'{cohort_name}' are one configuration — ref '{candidate.ref}' at "
                    f"reasoning_effort '{candidate.reasoning_effort}'"
                )
            else:
                first[key] = candidate.id

    # An anchor exists to license a cross-runtime comparison, so one that names models
    # inside a single cohort is measuring nothing and is almost certainly a typo.
    anchors: dict[str, set[str]] = {}
    for name, cohort in evaluation.cohorts.items():
        for candidate in cohort.models:
            if candidate.anchor:
                anchors.setdefault(candidate.anchor, set()).add(name)
    problems += [
        f"evaluation.yml: anchor '{anchor}' appears only in cohort "
        f"'{next(iter(cohorts))}'; an anchor pairs models across cohorts"
        for anchor, cohorts in sorted(anchors.items())
        if len(cohorts) < 2
    ]

    # The preference list is what `hip explain` resolves against, so an entry naming a
    # model no cohort declares is a silent fallthrough to the next tier rather than an
    # error at the point of use. Caught here instead.
    declared = {m.id for m in evaluation.models}
    problems += [
        f"evaluation.yml: generation.preference names '{model_id}', which no cohort "
        f"declares"
        for model_id in evaluation.generation.preference
        if model_id not in declared
    ]
    problems += [
        f"evaluation.yml: duplicate entry '{dup}' in generation.preference"
        for dup in _duplicates(evaluation.generation.preference)
    ]

    # SPEC requires the list to end at the local runtime: it is what keeps the
    # explanation layer working when every vendor is not.
    if evaluation.generation.preference:
        last = evaluation.generation.preference[-1]
        if last in declared and evaluation.cohort_for(last).runner == "hosted":
            problems.append(
                f"evaluation.yml: generation.preference ends at '{last}', which is "
                f"hosted. The list must end at a local model so that no vendor "
                f"decision can stop `hip explain` from running."
            )

    # A pin, not an alias. A withdrawn pin fails loudly and falls through; a repointed
    # alias changes published prose with nothing in the output to show it happened.
    problems += [
        f"evaluation.yml: model '{candidate.id}' pins ref '{candidate.ref}', which is "
        f"a moving alias. Name an explicit version."
        for cohort in evaluation.cohorts.values()
        if cohort.runner == "hosted"
        for candidate in cohort.models
        if candidate.ref.endswith(("-latest", "-preview"))
    ]

    # A hosted candidate with no rates cannot appear in the quality-per-dollar column,
    # which is most of why the rates are in config at all.
    problems += [
        f"evaluation.yml: hosted model '{candidate.id}' declares no token rates"
        for cohort in evaluation.cohorts.values()
        if cohort.runner == "hosted"
        for candidate in cohort.models
        if not candidate.billed_per_token
    ]
    return problems


def check_config(config_dir: Path | None = None) -> list[str]:
    """Load all three files and cross-check them. Returns a list of problems.

    Catches the class of error each file cannot see on its own: a metric naming a
    source that does not exist, or a source declaring an API key variable that is
    not set in the environment.
    """
    problems: list[str] = []
    sources = load_sources(config_dir)
    metrics = load_metrics(config_dir)
    load_geography(config_dir)
    problems.extend(_check_evaluation(config_dir))

    for metric_id, metric in metrics.items():
        if metric.source_id not in sources:
            problems.append(
                f"metrics.yml: {metric_id}.source_id: "
                f"'{metric.source_id}' is not defined in sources.yml"
            )
    for source_id, source in sources.items():
        if source.api_key_env and source.api_key_env not in os.environ:
            problems.append(
                f"sources.yml: {source_id}: requires {source.api_key_env}, "
                f"which is not set (see .env.example)"
            )
    return problems
