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
