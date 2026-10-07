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
from collections.abc import Callable, Iterator
from contextlib import contextmanager
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
    make: dict[str, int | list[int]] | None = None,
    moved: bool = True,
    mode: str = "ask",
    problem: str | None = None,
    requested: bool = True,
    freshness: list[str] | Exception | None = None,
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
        code = make_codes.get(cmd[-1], 0)
        # A list is one code per call, for a step that fails and then passes.
        return code.pop(0) if isinstance(code, list) else code

    def fake_notify(title: str, message: str, *, priority: int = 0) -> None:
        result.notes.append((title, priority))

    stamps: Callable[[], str] = iter(["before", "after" if moved else "before"]).__next__

    @contextmanager
    def fake_ollama() -> Iterator[str]:
        result.steps.append("ollama up")
        try:
            yield "stubbed"
        finally:
            result.steps.append("ollama down")

    def fake_freshness() -> list[str]:
        result.steps.append("compare freshness")
        if isinstance(freshness, Exception):
            raise freshness
        return freshness or []

    monkeypatch.setattr(script, "_ollama", fake_ollama)
    if hasattr(script, "_freshness_changes"):
        monkeypatch.setattr(script, "_freshness_changes", fake_freshness)
    monkeypatch.setattr(script, "_hip", fake_hip)
    monkeypatch.setattr(script, "_run", fake_run)
    monkeypatch.setattr(script, "_notify", fake_notify)
    monkeypatch.setattr(script, "_sleep", lambda seconds: result.steps.append("wait"))
    if hasattr(script, "_zillow_reminder"):
        # Read from this machine's files and today's date; its own tests cover it.
        monkeypatch.setattr(script, "_zillow_reminder", lambda: None)
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

    assert (run.code, run.steps) == (0, ["hip refresh", "compare freshness"])
    assert run.notes == [("Weekly refresh: a source was unreachable", 0)]


def test_a_quiet_week_stops_after_the_refresh_and_says_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", moved=False)

    assert (run.code, run.notes) == (0, [])
    assert run.steps == ["hip refresh", "compare freshness"]


def test_a_quiet_week_republishes_when_the_freshness_page_would_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ARCHITECTURE #232: a source out of reach, or back, reaches the page within the
    week. No figure moved, so no packet or reading is rebuilt on the way."""
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"refresh": 3},
        moved=False,
        freshness=["nj_modiv"],
    )

    assert run.steps == ["hip refresh", "compare freshness", *PUBLISH]
    assert run.code == 0
    assert run.notes == [("Weekly refresh: a source was unreachable", 0)]


def test_a_source_coming_back_republishes_without_a_notification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", moved=False, freshness=["nj_modiv"])

    assert run.steps == ["hip refresh", "compare freshness", *PUBLISH]
    assert (run.code, run.notes) == (0, [])


def test_a_failed_freshness_comparison_deploys_nothing_and_says_so(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch, "scheduled_refresh", moved=False, freshness=OSError("no route")
    )

    assert run.steps == ["hip refresh", "compare freshness"]
    assert run.code == 1
    assert run.notes == [("Weekly refresh: could not check the freshness page", 1)]


def test_a_week_that_moved_rebuilds_checks_and_publishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh")

    # `hip pack` without `--report`: the county reports are tracked by git, and
    # rewriting them would leave the shared checkout dirty after every run.
    # A week the figures moved does not compare the page: it is rebuilt regardless.
    assert run.steps == [
        "hip refresh",
        "hip pack",
        "hip explain --dry-run",
        *PUBLISH,
    ]
    assert (run.code, run.notes) == (0, [])


@pytest.mark.parametrize("code", [1, 2])
def test_a_failed_readings_check_alerts_regenerates_nothing_and_publishes_the_data(
    monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"explain --dry-run": code},
        mode="auto",
    )

    assert "hip explain" not in run.steps
    assert run.steps[-3:] == PUBLISH
    assert (run.code, run.notes) == (
        0,
        [("Weekly refresh: the readings check failed", 1)],
    )


def test_stale_readings_in_ask_mode_notify_and_still_publish_the_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(monkeypatch, "scheduled_refresh", hip={"explain --dry-run": 3})

    assert "hip explain" not in run.steps
    assert run.steps[-3:] == PUBLISH
    assert (run.code, run.notes) == (0, [("Readings are stale", 0)])


def test_a_partial_regeneration_in_auto_mode_still_publishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`hip explain` exits 3 when some readings were written but a region's reading
    could not be, or a model could not be used — Ollama quit when every hosted model
    failed, say. What was written still publishes."""
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"explain --dry-run": 3, "explain": 3},
        mode="auto",
    )

    assert run.steps[-6:] == ["ollama up", "hip explain", "ollama down", *PUBLISH]
    assert run.code == 0
    assert run.notes == [("Weekly refresh: some readings were not regenerated", 0)]


def test_a_failed_regeneration_in_auto_mode_alerts_and_still_publishes_the_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "scheduled_refresh",
        hip={"explain --dry-run": 3, "explain": 1},
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


@pytest.mark.parametrize("script", ["scheduled_refresh", "regenerate_now"])
def test_check_live_is_retried_once_before_the_urgent_alert(
    monkeypatch: pytest.MonkeyPatch, script: str
) -> None:
    # Regenerate now publishes only when there is something to regenerate.
    hip = {"explain --dry-run": 3} if script == "regenerate_now" else None
    # Failing once then passing is a CDN still settling: no alert.
    passed = _run(monkeypatch, script, hip=hip, make={"check-live": [2, 0]})
    assert passed.code == 0
    assert passed.steps[-3:] == ["run make check-live", "wait", "run make check-live"]
    assert all(priority != 1 for _, priority in passed.notes)
    # Failing twice is a real mismatch: urgent.
    failed = _run(monkeypatch, script, hip=hip, make={"check-live": [2, 2]})
    assert failed.code == 1
    assert failed.steps[-3:] == ["run make check-live", "wait", "run make check-live"]
    assert [priority for _, priority in failed.notes] == [1]


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
    run = _run(monkeypatch, "regenerate_now", hip={"explain --dry-run": 0})

    assert run.steps == ["hip explain --dry-run"]
    assert (run.code, run.notes) == (0, [("Nothing to regenerate", 0)])


@pytest.mark.parametrize("code", [1, 2])
def test_a_failed_check_never_reaches_the_paid_run(
    monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    """The review's first finding: exit 1 used to fall through to `hip explain`."""
    run = _run(monkeypatch, "regenerate_now", hip={"explain --dry-run": code})

    assert run.steps == ["hip explain --dry-run"]
    assert (run.code, run.notes) == (
        1,
        [("Regenerate now: the readings check failed", 1)],
    )


def test_a_regeneration_is_published(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run(monkeypatch, "regenerate_now", hip={"explain --dry-run": 3})

    # Ollama is up for the paid run alone: started before it, stopped before publishing.
    assert run.steps == [
        "hip explain --dry-run",
        "ollama up",
        "hip explain",
        "ollama down",
        *PUBLISH,
    ]
    assert (run.code, run.notes) == (0, [("Readings regenerated", 0)])


def test_a_partial_regeneration_is_published_and_says_so(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "regenerate_now",
        hip={"explain --dry-run": 3, "explain": 3},
    )

    assert run.steps[-3:] == PUBLISH
    assert (run.code, run.notes) == (0, [("Readings partly regenerated", 0)])


def test_a_regeneration_that_wrote_nothing_deploys_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run = _run(
        monkeypatch,
        "regenerate_now",
        hip={"explain --dry-run": 3, "explain": 1},
    )

    assert run.steps == [
        "hip explain --dry-run",
        "ollama up",
        "hip explain",
        "ollama down",
    ]
    assert (run.code, run.notes) == (1, [("Regenerate now: failed", 1)])


def test_ollama_is_never_started_without_a_paid_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ask mode, a clean check and a failed one all leave Ollama alone."""
    for hip, mode in (
        ({"explain --dry-run": 3}, "ask"),
        ({"explain --dry-run": 0}, "auto"),
        ({"explain --dry-run": 1}, "auto"),
    ):
        run = _run(monkeypatch, "scheduled_refresh", hip=hip, mode=mode)
        assert "ollama up" not in run.steps


def test_the_zillow_reminder_says_what_is_held_and_what_to_fetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zillow is fetched by hand (#272): the Friday run names the month held and the
    files to download, and is silent when nothing is due (#297)."""
    from datetime import date

    from hip.sources import zillow

    script = _load("scheduled_refresh")
    notes: list[tuple[str, str]] = []
    monkeypatch.setattr(
        script, "_notify", lambda title, message, **_: notes.append((title, message))
    )
    monkeypatch.setattr(
        zillow, "due", lambda raw, today: {"zillow_zori": date(2026, 8, 31)}
    )
    script._zillow_reminder()
    [(title, message)] = notes
    assert title == "Zillow: time to download"
    assert "August 2026" in message and "data/manual/zillow_zhvi" in message

    notes.clear()
    monkeypatch.setattr(zillow, "due", lambda raw, today: {})
    script._zillow_reminder()
    assert notes == []
