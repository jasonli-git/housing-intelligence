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
from pydantic import BaseModel, ConfigDict, Field, ValidationError
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

    @property
    def reports_dir(self) -> Path:
        """Human-facing output — validation reports and region reports.

        Beside `data/` rather than inside it: these are meant to be read and shared,
        while everything under `data/` is a rebuildable machine artifact.
        """
        return self.data_dir.parent / "reports"


class Source(BaseModel):
    """One public data source. ``adapter`` is resolved at Milestone 2."""

    model_config = ConfigDict(extra="forbid")

    name: str
    publisher: str
    license: str
    url: str
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


class CandidateModel(BaseModel):
    """One model under test. ``anchor`` pairs it with its counterpart in the other
    cohort, which is what licenses any cross-runtime comparison."""

    model_config = ConfigDict(extra="forbid")

    id: str
    ref: str
    label: str
    quantization: str
    anchor: str | None = None


class Cohort(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runner: Literal["ollama", "mlx"]
    endpoint: str | None = None
    models: list[CandidateModel] = Field(min_length=1)


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


class EvaluationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sampling: SamplingConfig
    limits: EvalLimits
    cohorts: dict[str, Cohort] = Field(min_length=1)
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

    evaluation = load_evaluation(config_dir)
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
