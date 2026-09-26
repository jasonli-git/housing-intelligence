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


def main() -> int:
    print(f"=== {datetime.now(UTC).isoformat()} scheduled refresh starting ===")
    before = _completed_at()

    refresh_code = _hip("refresh")
    if refresh_code == 1:
        _notify(
            "Weekly refresh failed",
            "hip refresh exited 1 — the pipeline itself failed. Nothing downstream "
            "ran. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    # Both a clean run (0) and one with an unreachable publisher (3) leave the
    # warehouse consistent (ARCHITECTURE #102) — the second is worth a heads-up, not a
    # stop. `RefreshState.completed_at` only moves when the pipeline actually ran, so
    # comparing it (not `refresh_code`) is what tells a quiet week from a real one:
    # `hip refresh` itself stops before the pipeline when nothing moved, and there is
    # nothing for `pack`, `explain` or a deploy to do that would produce different
    # bytes.
    if _completed_at() == before:
        print("nothing changed since the last completed refresh; stopping here")
        return 0

    if refresh_code == 3:
        _notify(
            "Weekly refresh: a source was unreachable",
            "hip refresh completed and the warehouse updated, but one or more "
            "publishers could not be reached this week. The site will still "
            "update from what did move.",
        )

    if _hip("pack", "--report") != 0:
        _notify(
            "Weekly refresh: packet build failed",
            "hip pack --report failed after the data refresh succeeded. Check the "
            "log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    # A cost report, not a generation: 0 means nothing is stale, 3 means something is,
    # and neither call reaches a model (`hip explain --dry-run`, this milestone).
    dry_run_code = _hip("explain", "--all", "--dry-run")
    if dry_run_code == 3:
        if _refresh_mode() == "auto":
            if _hip("explain", "--all") != 0:
                _notify(
                    "Weekly refresh: regenerating readings failed",
                    "hip explain --all did not complete cleanly in auto mode. Check "
                    "the log on the Mac.",
                    priority=_PRIORITY_URGENT,
                )
                return 1
        else:
            _notify(
                "Readings are stale",
                "This week's refresh moved the data behind one or more county "
                "readings. Regenerating is billed, so nothing was generated. "
                "Approve it from the Mac (hip regenerate-now) or your phone (the "
                "Regenerate Now shortcut) when you're ready — the rest of this "
                "week's data is publishing regardless.",
            )
            # Deliberately continue: the data-only changes still publish below, on the
            # same "stale readings deploy labelled stale, not withheld" basis a refresh
            # has always worked on.

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
