"""JSONL artifacts, one file per stage of a run.

Generation costs minutes of local inference and judging costs money, so the two are
separate files and neither is recomputed to produce the other. A run directory holds:

    data/eval/<run>/scenarios.jsonl
    data/eval/<run>/generations.jsonl
    data/eval/<run>/checks.jsonl
    data/eval/<run>/judgments.jsonl

JSONL rather than one JSON document because a run is appended to as it goes: a crash
forty generations in leaves thirty-nine usable records rather than an unparseable file.
The report reads whatever is present, so a partial run still produces a partial report
that says so.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from pathlib import Path

from pydantic import BaseModel

from hip.config import get_settings
from hip.eval.types import CheckResult, Generation, Judgment, Scenario

SCENARIOS = "scenarios.jsonl"
GENERATIONS = "generations.jsonl"
CHECKS = "checks.jsonl"
JUDGMENTS = "judgments.jsonl"


def eval_dir() -> Path:
    """Root for evaluation artifacts, beside the other machine-local data tiers."""
    return get_settings().data_dir / "eval"


def run_dir(run: str) -> Path:
    return eval_dir() / run


def write_records(path: Path, records: Iterable[BaseModel]) -> int:
    """Replace `path` with these records. Returns how many were written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w") as handle:
        for record in records:
            handle.write(record.model_dump_json() + "\n")
            count += 1
    return count


def append_record(path: Path, record: BaseModel) -> None:
    """Append one record, flushing so a crash keeps everything before it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        handle.write(record.model_dump_json() + "\n")
        handle.flush()


def read_records[T: BaseModel](path: Path, model: type[T]) -> list[T]:
    """Parse a JSONL file, or return empty when the stage has not run.

    A blank trailing line is tolerated; anything else that fails to parse raises,
    because a silently dropped record would understate a model's error rate.
    """
    if not path.exists():
        return []
    return [
        model.model_validate_json(line)
        for line in path.read_text().splitlines()
        if line.strip()
    ]


def load_scenarios(run: str) -> list[Scenario]:
    return read_records(run_dir(run) / SCENARIOS, Scenario)


def load_generations(run: str) -> list[Generation]:
    return read_records(run_dir(run) / GENERATIONS, Generation)


def load_checks(run: str) -> list[CheckResult]:
    return read_records(run_dir(run) / CHECKS, CheckResult)


def load_judgments(run: str) -> list[Judgment]:
    return read_records(run_dir(run) / JUDGMENTS, Judgment)


def completed_keys(run: str) -> set[str]:
    """Generation keys already recorded, so a resumed run skips finished work."""
    return {generation.key for generation in load_generations(run)}


def runs() -> Iterator[str]:
    """Existing run names, newest directory name last."""
    root = eval_dir()
    if not root.exists():
        return iter([])
    return iter(sorted(p.name for p in root.iterdir() if p.is_dir()))
