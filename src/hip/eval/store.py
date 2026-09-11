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


def _records_in(path: Path) -> int:
    """How many records a JSONL file holds, without parsing them."""
    if not path.exists():
        return 0
    with path.open() as handle:
        return sum(1 for line in handle if line.strip())


def has_judgments(run: str) -> bool:
    """Whether any verdict has been recorded for `run`."""
    return _records_in(run_dir(run) / JUDGMENTS) > 0


def scenario_set_problem(run: str, *, replace: bool) -> str | None:
    """Why `hip eval scenarios` may not write `run`'s scenario set, or None if it may.

    A scenario set is the exact bytes every model in a run was given, so it is frozen
    once anything has been generated against it: rebuilding it would leave recorded
    answers checked and graded against packets they were never shown. Before that it is
    a draft, and `--replace` may rebuild it — but never by default. Until 2026-09-10 the
    command replaced any existing set without asking, while every `hip eval` command
    defaulted to `--run v1`, so README's bare commands would have rewritten `v1` (#103).
    """
    if not (run_dir(run) / SCENARIOS).exists():
        return None
    recorded = _records_in(run_dir(run) / GENERATIONS)
    if recorded:
        return (
            f"run '{run}' has {recorded:,} generations measured against its scenario "
            "set, which is therefore frozen — build a new run under another --run name"
        )
    if not replace:
        return (
            f"run '{run}' already has a scenario set. Nothing has been generated against "
            "it yet, so --replace may rebuild it"
        )
    return None


def runs() -> Iterator[str]:
    """Existing run names, most recently written last.

    Ordered by modification time rather than by name. `selection.latest_run` takes the
    last judged entry as "the most recent evaluation", and a lexical sort puts `v10`
    before `v2` — which would silently generate the whole site's prose with an older
    run's winner. The name is a label; the filesystem knows which run happened last.
    """
    root = eval_dir()
    if not root.exists():
        return iter([])
    directories = [p for p in root.iterdir() if p.is_dir()]
    # Name breaks ties, so two runs written in the same clock tick still order
    # deterministically rather than by directory-iteration order.
    return iter(
        p.name for p in sorted(directories, key=lambda d: (d.stat().st_mtime, d.name))
    )
