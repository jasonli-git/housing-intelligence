"""Undo the last deploy's data half (ARCHITECTURE #359).

A deploy has two halves. Cloudflare Pages keeps every deployment of the site, so the
pages can be rolled back from its dashboard; but `rclone sync` overwrote the R2
artifacts in place, so the data behind them could not. Now `make deploy` keeps, in a
private bucket, every file the sync replaced or deleted (`--backup-dir`) and the list of
keys that were live before it (`_keys.txt`). Restoring is the reverse: copy those files
back, and delete what the deploy added.

**A rollback must never bring back an address withdrawn under Daniel's Law.** The backup
is the build before the last one; if a removal was recorded since, restoring it would
publish that parcel again. So the command refuses unless the removal list now is exactly
the list that build honoured, by the publish ledger (`hip.removals`). The backup bucket
is private for the same reason: it holds addresses that may since have been withdrawn.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from hip.removals import fingerprint, honoured_by, read


class RollbackRefused(RuntimeError):
    """Rolling back would be unsafe or is impossible; nothing was changed."""


@dataclass(frozen=True)
class Plan:
    built: str  # the `generated_at` of the build being restored
    restore: int  # files to copy back from the backup
    delete: list[str]  # keys the last deploy added, to remove


def added_keys(before: set[str], live: set[str]) -> list[str]:
    """Keys live now that were not before the last deploy: what it added."""
    return sorted(live - before)


def check_removals(removals_file: Path, built: str) -> None:
    """Refuse unless the removal list is exactly what the build `built` honoured."""
    recorded = honoured_by(removals_file, built)
    if recorded is None:
        raise RollbackRefused(
            f"the publish ledger has no record of build {built}, so whether restoring it "
            "would bring back a withdrawn address cannot be checked. Redeploy a fresh "
            "build instead."
        )
    if recorded != fingerprint(read(removals_file)):
        raise RollbackRefused(
            f"the Daniel's Law removal list has changed since build {built}; "
            "restoring it would put a withdrawn address back. Fix forward and "
            "redeploy instead."
        )


def _rclone(*args: str) -> str:
    done = subprocess.run(["rclone", *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise RollbackRefused(
            f"rclone {' '.join(args[:2])} failed: {done.stderr.strip()}"
        )
    return done.stdout


def plan(remote: str, bucket: str, backup: str, removals_file: Path) -> Plan:
    """What a rollback would do, after every check, without changing anything."""
    try:
        manifest = json.loads(_rclone("cat", f"{remote}:{backup}/files/manifest.json"))
    except (RollbackRefused, json.JSONDecodeError) as error:
        raise RollbackRefused(
            f"no backup to roll back to in {backup} (the last deploy kept none, or a "
            "rollback already used it)."
        ) from error
    built = str(manifest["generated_at"])
    check_removals(removals_file, built)
    before = set(_rclone("cat", f"{remote}:{backup}/_keys.txt").split())
    live = set(_rclone("lsf", "-R", "--files-only", f"{remote}:{bucket}").split())
    files = _rclone("lsf", "-R", "--files-only", f"{remote}:{backup}/files").split()
    return Plan(built=built, restore=len(files), delete=added_keys(before, live))


def run(remote: str, bucket: str, backup: str, plan_: Plan) -> None:
    """Restore the backup over the live bucket, then empty the backup.

    Emptied afterwards because it describes the build before the one just restored, not
    the one before that: a second rollback from it would be wrong.
    """
    _rclone("copy", f"{remote}:{backup}/files", f"{remote}:{bucket}", "--checksum")
    if plan_.delete:
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as listed:
            listed.write("\n".join(plan_.delete) + "\n")
        _rclone("delete", f"{remote}:{bucket}", "--files-from", listed.name)
        Path(listed.name).unlink()
    _rclone("delete", f"{remote}:{backup}")
