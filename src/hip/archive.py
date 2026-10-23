"""The raw archive's home in object storage (Milestone 56, ARCHITECTURE #437).

`data/raw/` is the archive of record: every file a fact cites must stay reachable, so
`hip prune-raw` can never delete one (#10). Kept only on the Mac, that rule makes the
archive grow without bound — 5.4GB on 2026-10-22, 4.2GB of it from the month before.
So the archive's home moves to a private R2 bucket, and `data/raw/` becomes a working
copy of it:

* **push** copies every new file up after acquisition. The layout is already
  content-addressed (`<source>/<sha[:16]>/<file>`), so the bucket uses the same keys
  and an unchanged release is never uploaded twice.
* **restore** brings one release's file back when a stage needs it and the Mac no
  longer holds it, and checks its SHA-256 against the manifest before using it.
* **trim** removes local files the bucket is known to hold, never a source's current
  release, and never a manifest: manifests and indexes are kilobytes, read on every
  run, and are what says a file exists at all.

Unset, nothing here runs and `data/raw/` behaves as it always has. rclone does the
transfers, as it does for `make deploy`, so there is one way to reach R2 rather than
two (#359).
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

MANIFEST = "manifest.json"


class ArchiveError(RuntimeError):
    """The bucket could not be reached, or answered something unexpected."""


def _rclone(*args: str) -> str:
    done = subprocess.run(["rclone", *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise ArchiveError(f"rclone {args[0]} failed: {done.stderr.strip()}")
    return done.stdout


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _named(manifest: Path) -> str | None:
    try:
        return str(json.loads(manifest.read_text())["filename"])
    except (json.JSONDecodeError, KeyError, OSError):
        return None


def archive_files(raw_dir: Path) -> list[str]:
    """Every file under `raw_dir` that belongs in the bucket, as keys relative to it.

    Inside a release directory that is the manifest and the one file it names, nothing
    else. Releases fetched before 2026-08-12 also hold a duplicate of their file under
    the request URL it was fetched with, and for the Census API that URL carried the key;
    the manifest's name is the redacted one (#76), so naming only it keeps the key off R2.
    """
    keys: list[str] = []
    for path in sorted(raw_dir.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        manifest = path.parent / MANIFEST
        if path.name != MANIFEST and manifest.exists() and path.name != _named(manifest):
            continue
        keys.append(path.relative_to(raw_dir).as_posix())
    return keys


@dataclass(frozen=True)
class Trimmable:
    path: Path
    size_bytes: int


def _current(source_dir: Path) -> set[str]:
    """The `sha[:16]` directories a source's index points at."""
    index = source_dir / "index.json"
    if not index.exists():
        return set()
    return {sha[:16] for sha in json.loads(index.read_text()).values()}


def trimmable(
    raw_dir: Path, held: dict[str, int], *, keep_days: int, now: datetime | None = None
) -> list[Trimmable]:
    """Local release files that are safe to remove: in the bucket at the same size,
    not current for their source, and fetched more than `keep_days` ago.

    `held` is the bucket's listing, key to size. A file the listing lacks, or holds at
    another size, stays: the bucket's copy is what makes removing it safe, so the
    listing is checked rather than a record of what was pushed.
    """
    cutoff = (now or datetime.now(UTC)) - timedelta(days=keep_days)
    found: list[Trimmable] = []
    for source_dir in sorted(p for p in raw_dir.iterdir() if p.is_dir()):
        try:
            current = _current(source_dir)
        except (json.JSONDecodeError, OSError):
            # Cannot tell what is current, so nothing in this source is safe to remove.
            continue
        for release_dir in sorted(p for p in source_dir.iterdir() if p.is_dir()):
            manifest = release_dir / MANIFEST
            if release_dir.name in current or not manifest.exists():
                continue
            try:
                data = json.loads(manifest.read_text())
                fetched = datetime.fromisoformat(data["fetched_at"])
            except (json.JSONDecodeError, KeyError, OSError, ValueError):
                continue
            payload = release_dir / data["filename"]
            if not payload.exists() or fetched > cutoff:
                continue
            size = payload.stat().st_size
            if held.get(payload.relative_to(raw_dir).as_posix()) == size:
                found.append(Trimmable(path=payload, size_bytes=size))
    return found


class Archive:
    """A raw archive in an rclone remote, keyed exactly as `data/raw/` is laid out."""

    def __init__(self, remote: str) -> None:
        # `r2-raw:housing-raw` — an rclone remote and bucket, with or without a prefix.
        self.remote = remote.rstrip("/")

    def _key(self, key: str) -> str:
        return f"{self.remote}/{key}"

    def push(self, raw_dir: Path) -> int:
        """Copy every archive file not already in the bucket up to it; return how many
        files were considered. Never deletes from the bucket: a file trimmed from the
        Mac is still the archive's."""
        keys = archive_files(raw_dir)
        if not keys:
            return 0
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as listing:
            listing.write("\n".join(keys) + "\n")
        try:
            # `--size-only`: every release file is immutable and named by its hash, so a
            # file of the same name and size is the same file; the index files that do
            # change also change size whenever they gain an entry. Asking R2 for an MD5
            # of each of ~3,000 objects to learn the same thing is slower for no gain.
            _rclone(
                "copy",
                str(raw_dir),
                self.remote,
                "--files-from-raw",
                listing.name,
                "--size-only",
                "--no-traverse",
            )
        finally:
            Path(listing.name).unlink(missing_ok=True)
        return len(keys)

    def listing(self) -> dict[str, int]:
        """Every key in the bucket, with its size."""
        out = _rclone(
            "lsjson", "-R", "--files-only", "--no-mimetype", "--no-modtime", self.remote
        )
        return {item["Path"]: int(item["Size"]) for item in json.loads(out or "[]")}

    def restore(self, path: Path, raw_dir: Path, sha256: str) -> bool:
        """Bring one release file back from the bucket, if it holds the right bytes.

        Downloads beside the destination and moves into place only once the hash
        matches the manifest's, so a truncated or wrong copy never stands in for the
        real one. False, never an exception, when it cannot: the caller then treats the
        release as absent, which is what it did before the archive existed.
        """
        key = path.relative_to(raw_dir).as_posix()
        with tempfile.TemporaryDirectory(prefix="hip-restore-", dir=path.parent) as tmp:
            staged = Path(tmp) / path.name
            try:
                _rclone("copyto", self._key(key), str(staged))
            except ArchiveError as exc:
                logger.warning("archive: could not restore %s (%s)", key, exc)
                return False
            if _sha256(staged) != sha256:
                logger.warning(
                    "archive: %s in the bucket does not match its manifest", key
                )
                return False
            shutil.move(str(staged), path)
        return True

    def pull_index(self, raw_dir: Path) -> None:
        """Copy every manifest and index down, and no release file: what a new Mac
        needs before any stage can find a release, or restore one."""
        raw_dir.mkdir(parents=True, exist_ok=True)
        _rclone(
            "copy",
            self.remote,
            str(raw_dir),
            "--include",
            f"/*/*/{MANIFEST}",
            "--include",
            "/*/*.json",
            "--include",
            "/*.json",
        )


def configured() -> Archive | None:
    """The archive `HIP_ARCHIVE_REMOTE` names, or None when it is unset."""
    from hip.config import get_settings

    remote = get_settings().archive_remote
    return Archive(remote) if remote else None
