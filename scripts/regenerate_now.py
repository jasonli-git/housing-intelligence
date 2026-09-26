#!/usr/bin/env python3
"""Regenerate stale readings on demand, approved from the Mac or an iPhone (Milestone 27).

Two ways to reach this script, both landing on the same file:

* the Mac: `hip regenerate-now` touches `RefreshGate`'s trigger file directly.
* the phone: a Shortcut writes the same file through iCloud Drive.

A `launchd` agent with `WatchPaths` on that exact path (`scripts/launchd/*.regenerate-
now.plist`) wakes the instant either happens and runs this script — no polling, and no
difference in effect between the two doors.

This is the *approval* path, not the weekly schedule: it runs the paid step regardless
of `RefreshGate.mode`, because reaching it at all means someone just asked for it.
`ask` mode governs whether the weekly run may do this on its own; it says nothing about
a request made on purpose right now.
"""

from __future__ import annotations

import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

_PRIORITY_URGENT = 1


def _run(cmd: list[str]) -> int:
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=REPO_ROOT).returncode


def _hip(*args: str) -> int:
    return _run(["uv", "run", "hip", *args])


def _notify(title: str, message: str, *, priority: int = 0) -> None:
    _run(["uv", "run", "hip", "notify", "--title", title, "--message", message,
          "--priority", str(priority)])  # fmt: skip


def main() -> int:
    from hip.config import get_settings
    from hip.refresh import handle_regenerate_request, regenerate_requested

    settings = get_settings()
    print(f"=== {datetime.now(UTC).isoformat()} regenerate-now triggered ===")

    # WatchPaths can fire once for a burst of filesystem events (e.g. the agent's own
    # first load, or an editor that writes-then-renames). Requiring the trigger to
    # still be present, then consuming it immediately, means a spurious or repeated
    # firing for one real request does nothing the second time.
    if not regenerate_requested(settings.gate_dir):
        print("no pending request; nothing to do")
        return 0
    handle_regenerate_request(settings.gate_dir)

    # A free check first: someone can tap "Regenerate Now" when nothing is actually
    # stale, and that must cost nothing.
    if _hip("explain", "--all", "--dry-run") == 0:
        _notify(
            "Nothing to regenerate",
            "Regenerate Now was triggered, but every reading is already current. "
            "Nothing was generated.",
        )
        return 0

    if _hip("explain", "--all") != 0:
        _notify(
            "Regenerate now: failed",
            "hip explain --all did not complete cleanly. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    if _run(["make", "publish"]) != 0:
        _notify(
            "Regenerate now: publish failed",
            "Readings were regenerated, but make publish failed. The site was not "
            "rebuilt. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    if _run(["make", "deploy"]) != 0:
        _notify(
            "Regenerate now: deploy failed",
            "The rebuilt site was not published. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    if _run(["make", "check-live"]) != 0:
        _notify(
            "Regenerate now: check-live failed after deploy",
            "The site deployed, but check-live could not confirm it matches what "
            "was built. Check the log on the Mac.",
            priority=_PRIORITY_URGENT,
        )
        return 1

    _notify("Readings regenerated", "New readings are live.")
    print(f"=== {datetime.now(UTC).isoformat()} regenerate-now complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
