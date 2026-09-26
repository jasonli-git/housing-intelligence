#!/usr/bin/env python3
"""The weekly, unattended run: refresh, then reach the reader (Milestone 27).

Before this milestone, `hip refresh` stopped after `analyze` — the warehouse updated
and everything past it (packets, readings, the published site) stayed exactly as it
was. That gap is what turned a real, successful refresh into 105 stale readings on
2026-09-23: the data moved and nothing downstream of it knew.

This is a Python script rather than a shell one on purpose: the gating logic below
branches on three independent outcomes (did anything change, is a source unreachable,
would regenerating cost money) and calling `hip`/`make` from `subprocess` keeps each
step's exit code an integer to test against instead of a string to parse.

**What runs unattended, and what does not** (decided with the owner, TODO.md `Now`):
refreshing the data, rebuilding packets and the site, and deploying all run every time,
whether or not anything is stale — that is unchanged from what a refresh already does.
Regenerating AI readings is the one gated step, because it is billed. The gate
(`RefreshGate`, read fresh every run — never cached across weeks) defaults to `"ask"`:
found stale readings, notified, and left them stale rather than spending anything.
`"auto"` regenerates without asking. Toggling either way, and an on-demand
"regenerate now" outside the schedule, both work identically from this Mac
(`hip refresh-mode`, `hip regenerate-now`) or an iPhone Shortcut writing the same file.

Meant to be run by `launchd` (see `scripts/launchd/`), which sets `PATH` so `uv`,
`make`, `wrangler` and `rclone` resolve, and redirects stdout/stderr to a log file —
this script does neither itself, so running it by hand behaves the same way.
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

# A source unreachable is a real, actionable event (ARCHITECTURE #29's whole point was
# ending the silence around exactly this), but it must not be raised at Pushover's
# urgent/insistent priority the way a broken pipeline is — the numbers are still
# consistent and the site still deploys.
_PRIORITY_URGENT = 1
_PRIORITY_NORMAL = 0


def _run(cmd: list[str]) -> int:
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=REPO_ROOT).returncode


def _hip(*args: str) -> int:
    return _run(["uv", "run", "hip", *args])


def _notify(title: str, message: str, *, priority: int = _PRIORITY_NORMAL) -> None:
    _run(["uv", "run", "hip", "notify", "--title", title, "--message", message,
          "--priority", str(priority)])  # fmt: skip


def _completed_at() -> str | None:
    """`RefreshState.completed_at`, read fresh so a quiet week is detected honestly."""
    from hip.config import get_settings
    from hip.refresh import RefreshState

    return RefreshState.read(get_settings().raw_dir).completed_at


def _refresh_mode() -> str:
    from hip.config import get_settings
    from hip.refresh import RefreshGate

    return RefreshGate.read(get_settings().gate_dir).mode


def _ollama():  # type: ignore[no-untyped-def]
    """Ollama up for a regeneration and back as it was after (ARCHITECTURE #230).

    The local model is one of the readings `hip explain --all` writes, and the owner
    keeps Ollama quit between runs. A seam of its own so the tests never start a server.
    """
    from hip.eval.runners.ollama import serving

    logs = REPO_ROOT / "logs"
    logs.mkdir(exist_ok=True)
    return serving(log_path=logs / "ollama.log")


# Where the published site's data lives; `make deploy` puts `freshness.json` there.
_ARTIFACT_URL = os.environ.get("ARTIFACT_URL", "https://housing-data.jasonli.app")


def _freshness_changes() -> list[str]:
    """Sources whose line on the live freshness page would now read differently (#232).

    Read against the live `freshness.json` rather than `dist/`, because what matters is
    what a reader has: a build that was never deployed is not their page. A live page
    that cannot be read counts as changed — the rebuild that causes is the cheap
    mistake, and a page left saying the wrong thing is the expensive one.
    """
    import httpx
    from sqlalchemy.orm import Session

    from hip.config import get_settings, load_sources
    from hip.warehouse.db import get_engine
    from hip.warehouse.freshness import build_report, page_changes

    with Session(get_engine()) as session:
        current = build_report(session, load_sources(get_settings().config_dir))
    try:
        response = httpx.get(f"{_ARTIFACT_URL}/freshness.json", timeout=30.0)
        published = response.json() if response.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        published = None
    return page_changes(published, current)


def _rebuild_readings() -> int | None:
    """Packets, then readings, for a week the figures moved. An exit code to stop on."""
    # Every packet rebuilt and checked against its schema before anything is published.
    # Not `--report`: that rewrites the county reports git tracks, which would leave
    # this shared checkout dirty after every run, and the site does not read them.
    if _hip("pack") != 0:
        _notify(
            "Weekly refresh: packet build failed",
            "hip pack failed after the data refresh succeeded. Nothing was deployed. "
            "Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    # The free check: 0 means nothing is stale and 3 that something is, and no model is
    # called either way (`hip explain --dry-run`). Anything else means the check itself
    # failed, which says nothing about the readings: it is never read as "none stale",
    # and nothing is regenerated on it. The data still publishes — the site labels any
    # reading whose figures moved as stale, whether or not this check could tell.
    dry_run_code = _hip("explain", "--all", "--dry-run")
    if dry_run_code not in (0, 3):
        _notify(
            "Weekly refresh: the readings check failed",
            f"hip explain --all --dry-run exited {dry_run_code}, so no reading was "
            "regenerated. The data still publishes, with any reading whose figures "
            "moved labelled stale. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
    elif dry_run_code == 3:
        if _refresh_mode() == "auto":
            # `hip explain` exits 0, 3 (some readings written, a model or region
            # skipped) or 1 (none written), and a scheduled refresh deploys on any of
            # them: a reading that was not rewritten stays up labelled stale, and the
            # data behind it is still worth publishing (eval_cli.PARTIAL, #102).
            with _ollama() as ollama:
                print(ollama, flush=True)
                explain_code = _hip("explain", "--all")
            if explain_code == 3:
                _notify(
                    "Weekly refresh: some readings were not regenerated",
                    "A model or region was skipped. What was written is publishing, "
                    "and the rest stays up labelled stale. Check the log on the Mac.",
                )
            elif explain_code != 0:
                _notify(
                    "Weekly refresh: regenerating readings failed",
                    f"hip explain --all exited {explain_code} without finishing. The "
                    "data still publishes, and any reading not rewritten stays up "
                    "labelled stale. Check the log on the Mac.",
                    priority=_PRIORITY_URGENT,
                )
        else:
            _notify(
                "Readings are stale",
                "This week's refresh moved the data behind one or more county "
                "readings. Regenerating is billed, so nothing was generated. "
                "Approve it from the Mac (hip regenerate-now) or your phone (the "
                "Regenerate Now shortcut) when you're ready — the rest of this "
                "week's data is publishing regardless.",
            )
            # Deliberately continue: the data-only changes still publish after this, on
            # the same "stale readings deploy labelled stale, not withheld" basis a
            # refresh has always worked on.
    return None


def main() -> int:
    from hip.refresh import checkout_problem

    print(f"=== {datetime.now(UTC).isoformat()} scheduled refresh starting ===")
    # Before anything runs: this checkout is shared with development, and only a
    # clean `main` may refresh the warehouse or deploy (`checkout_problem`).
    problem = checkout_problem(REPO_ROOT)
    if problem:
        print(f"skipped: {problem}")
        _notify(
            "Weekly refresh skipped",
            f"{problem}. The data was not refreshed and nothing was deployed; "
            "merge or put the work away, and the next run picks it up.",
        )
        return 2
    before = _completed_at()

    refresh_code = _hip("refresh")
    if refresh_code not in (0, 3):
        # 1 is a pipeline failure; anything else — Click's 2 for a usage error, a
        # crash's traceback exit — is not a result `hip refresh` defines, and must not
        # be read as a clean run either.
        _notify(
            "Weekly refresh failed",
            f"hip refresh exited {refresh_code}, so the pipeline did not complete. "
            "Nothing downstream ran. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    # `RefreshState.completed_at` only moves when the pipeline actually ran, so comparing
    # it (not `refresh_code`) is what tells a quiet week from a real one. A quiet week
    # still republishes when the freshness page would read differently — a source out
    # of reach or back, a release now waiting — since the page should carry that within
    # the week, and nothing else about the site has moved (ARCHITECTURE #232).
    quiet = _completed_at() == before
    changes: list[str] = []
    if quiet:
        try:
            changes = _freshness_changes()
        except Exception as exc:  # the one place a surprise must reach the phone
            _notify(
                "Weekly refresh: could not check the freshness page",
                f"Comparing the freshness page with the published one failed ({exc}). "
                "Nothing was deployed. Check the log on the Mac.",
                priority=_PRIORITY_URGENT,
            )
            return 1

    # An unreachable publisher (3) leaves the warehouse consistent (ARCHITECTURE #102),
    # which is worth a heads-up, not a stop — and it is said even in a quiet week: a
    # week in which the one source that failed was also the only one that might have
    # moved is exactly the outage a person needs to hear about.
    if refresh_code == 3:
        _notify(
            "Weekly refresh: a source was unreachable",
            "One or more publishers could not be reached this week, so their figures "
            "are the last ones fetched. "
            + (
                "The site still updates from what did move."
                if not quiet
                else "Nothing else moved; the freshness page is republished to say so."
                if changes
                else "Nothing else moved, so the site was left as it was."
            ),
        )

    if quiet and not changes:
        print("nothing changed since the last completed refresh; stopping here")
        return 0
    if quiet:
        # No figure moved, so no packet or reading did: straight to publishing.
        print(f"no figure moved; the freshness page changes for {', '.join(changes)}")
    else:
        stop = _rebuild_readings()
        if stop is not None:
            return stop

    if _run(["make", "publish"]) != 0:
        _notify(
            "Weekly refresh: publish failed",
            "make publish failed after the data refresh succeeded. Check the log on "
            "the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    if _run(["make", "deploy"]) != 0:
        _notify(
            "Weekly refresh: deploy failed",
            "make deploy failed. The built site was not published. Check the log on "
            "the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    if _run(["make", "check-live"]) != 0:
        _notify(
            "Weekly refresh: check-live failed after deploy",
            "The site deployed, but check-live could not confirm it matches what "
            "was built. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    print(f"=== {datetime.now(UTC).isoformat()} scheduled refresh complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
