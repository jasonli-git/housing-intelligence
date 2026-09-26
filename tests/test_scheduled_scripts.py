"""The two unattended scripts, step by step, with every command stubbed.

`scripts/scheduled_refresh.py` and `scripts/regenerate_now.py` decide what runs next
from exit codes alone, and until Codex's Milestone 27 review nothing ran them: the
commands they call were tested, the order between them was not. Three defects lived in
that gap — a failed free check that went on to the paid run, a partial regeneration
that stopped the deploy, and an unreachable publisher in a quiet week that reported
nothing — and each case below pins one path through them.

Nothing here runs `hip`, `make` or Pushover: each script's `_hip`, `_run` and `_notify`
are replaced by a recorder, and the checkout guard is told the checkout is clean unless
a test says otherwise.
"""

from __future__ import annotations

import importlib.util
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType

import pytest

from hip import refresh

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
PUBLISH = ["run make publish", "run make deploy", "run make check-live"]


def _load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@dataclass
class Run:
    code: int
    steps: list[str] = field(default_factory=list)
    # (title, priority) of every notification sent.
    notes: list[tuple[str, int]] = field(default_factory=list)


def _run(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    *,
    hip: dict[str, int] | None = None,
    make: dict[str, int] | None = None,
    moved: bool = True,
    mode: str = "ask",
    problem: str | None = None,
    requested: bool = True,
) -> Run:
    script = _load(name)
    result = Run(code=-1)
    hip_codes = hip or {}
    make_codes = make or {}

    def fake_hip(*args: str) -> int:
        command = " ".join(args)
        result.steps.append(f"hip {command}")
        return hip_codes.get(command, 0)

    def fake_run(cmd: list[str]) -> int:
        result.steps.append("run " + " ".join(cmd))
        return make_codes.get(cmd[-1], 0)

    def fake_notify(title: str, message: str, *, priority: int = 0) -> None:
        result.notes.append((title, priority))

    stamps: Callable[[], str] = iter(["before", "after" if moved else "before"]).__next__
    monkeypatch.setattr(script, "_hip", fake_hip)
    monkeypatch.setattr(script, "_run", fake_run)
    monkeypatch.setattr(script, "_notify", fake_notify)
    if hasattr(script, "_completed_at"):
        monkeypatch.setattr(script, "_completed_at", stamps)
        monkeypatch.setattr(script, "_refresh_mode", lambda: mode)
    monkeypatch.setattr(refresh, "checkout_problem", lambda root: problem)
    monkeypatch.setattr(refresh, "regenerate_requested", lambda gate: requested)
    monkeypatch.setattr(refresh, "handle_regenerate_request", lambda gate: None)
    result.code = script.main()
    return result


# ------------------------------------------------------------- weekly refresh ---


def test_a_checkout_that_is_not_a_clean_main_runs_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", problem="the checkout is on 'x'")

    assert (run.code, run.steps) == (2, [])
    assert run.notes == [("Weekly refresh skipped", 0)]


@pytest.mark.parametrize("code", [1, 2, 137])
def test_any_refresh_exit_but_0_or_3_is_a_failure(
    monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    """2 is Click's usage error, which used to be read as a clean run and deployed."""
    run = _run(monkeypatch, "scheduled_refresh", hip={"refresh": code})

    assert (run.code, run.steps) == (1, ["hip refresh"])
    assert run.notes == [("Weekly refresh failed", 1)]


def test_an_unreachable_publisher_in_a_quiet_week_is_still_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", hip={"refresh": 3}, moved=False)

    assert (run.code, run.steps) == (0, ["hip refresh"])
    assert run.notes == [("Weekly refresh: a source was unreachable", 0)]


def test_a_quiet_week_stops_after_the_refresh_and_says_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", moved=False)

    assert (run.code, run.steps, run.notes) == (0, ["hip refresh"], [])


def test_a_week_that_moved_rebuilds_checks_and_publishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh")

    # `hip pack` without `--report`: the county reports are tracked by git, and
    # rewriting them would leave the shared checkout dirty after every run.
    assert run.steps == [
        "hip refresh",
        "hip pack",
        "hip explain --all --dry-run",
        *PUBLISH,
    ]
    assert (run.code, run.notes) == (0, [])


@pytest.mark.parametrize("code", [1, 2])
def test_a_failed_readings_check_is_not_read_as_nothing_stale(
    monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", hip={"explain --all --dry-run": code})

    assert run.code == 1
    assert run.steps[-1] == "hip explain --all --dry-run"
    assert run.notes == [("Weekly refresh: the readings check failed", 1)]


def test_stale_readings_in_ask_mode_notify_and_still_publish_the_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", hip={"explain --all --dry-run": 3})

    assert "hip explain --all" not in run.steps
    assert run.steps[-3:] == PUBLISH
    assert (run.code, run.notes) == (0, [("Readings are stale", 0)])


def test_a_partial_regeneration_in_auto_mode_still_publishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`hip explain` exits 3 when some readings were written and a model was skipped —
    which, with Ollama quit, is every run that needs the local model."""
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"explain --all --dry-run": 3, "explain --all": 3},
        mode="auto",
    )

    assert run.steps[-4:] == ["hip explain --all", *PUBLISH]
    assert run.code == 0
    assert run.notes == [("Weekly refresh: some readings were not regenerated", 0)]


def test_a_failed_regeneration_in_auto_mode_alerts_and_still_publishes_the_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"explain --all --dry-run": 3, "explain --all": 1},
        mode="auto",
    )

    assert run.steps[-3:] == PUBLISH
    assert run.notes == [("Weekly refresh: regenerating readings failed", 1)]


@pytest.mark.parametrize("target", ["publish", "deploy", "check-live"])
def test_a_failed_publishing_step_stops_there(
    monkeypatch: pytest.MonkeyPatch, target: str
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", make={target: 2})

    assert run.code == 1
    assert run.steps[-1] == f"run make {target}"
    assert [priority for _, priority in run.notes] == [1]


# ------------------------------------------------------------- regenerate now ---


def test_no_request_does_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run(monkeypatch, "regenerate_now", requested=False)

    assert (run.code, run.steps, run.notes) == (0, [], [])


def test_a_request_on_the_wrong_checkout_is_refused(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "regenerate_now", problem="main has uncommitted work: x")

    assert (run.code, run.steps) == (2, [])
    assert run.notes == [("Regenerate now skipped", 0)]


def test_nothing_stale_costs_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run(monkeypatch, "regenerate_now", hip={"explain --all --dry-run": 0})

    assert run.steps == ["hip explain --all --dry-run"]
    assert (run.code, run.notes) == (0, [("Nothing to regenerate", 0)])


@pytest.mark.parametrize("code", [1, 2])
def test_a_failed_check_never_reaches_the_paid_run(
    monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    """The review's first finding: exit 1 used to fall through to `hip explain --all`."""
    run = _run(monkeypatch, "regenerate_now", hip={"explain --all --dry-run": code})

    assert run.steps == ["hip explain --all --dry-run"]
    assert (run.code, run.notes) == (
        1,
        [("Regenerate now: the readings check failed", 1)],
    )


def test_a_regeneration_is_published(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run(monkeypatch, "regenerate_now", hip={"explain --all --dry-run": 3})

    assert run.steps == ["hip explain --all --dry-run", "hip explain --all", *PUBLISH]
    assert (run.code, run.notes) == (0, [("Readings regenerated", 0)])


def test_a_partial_regeneration_is_published_and_says_so(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "regenerate_now",
        hip={"explain --all --dry-run": 3, "explain --all": 3},
    )

    assert run.steps[-3:] == PUBLISH
    assert (run.code, run.notes) == (0, [("Readings partly regenerated", 0)])


def test_a_regeneration_that_wrote_nothing_deploys_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "regenerate_now",
        hip={"explain --all --dry-run": 3, "explain --all": 1},
    )

    assert run.steps == ["hip explain --all --dry-run", "hip explain --all"]
    assert (run.code, run.notes) == (1, [("Regenerate now: failed", 1)])
