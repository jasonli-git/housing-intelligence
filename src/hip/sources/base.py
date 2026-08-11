"""Source adapter protocol and the shared download machinery.

Every public source is reached through one adapter. Adapters declare *what* to fetch;
this module does the fetching, so retry, caching, content addressing, and manifest
writing are implemented once and behave identically for all ten sources.

Raw downloads are immutable and content-addressed (ARCHITECTURE #10): a file lands at
``data/raw/<source_id>/<sha256[:16]>/<filename>`` and is never overwritten. Re-fetching
an unchanged upstream file produces the same directory and no new release.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

import httpx

CHUNK_BYTES = 1 << 20
_TIMEOUT = httpx.Timeout(30.0, read=300.0)
_RETRIES = 3


class SourceError(Exception):
    """A source could not be fetched. Carries the source and layer that failed."""


@dataclass(frozen=True)
class ReleaseRef:
    """What to fetch, before anything has been fetched.

    Uniquely identified by (source_id, layer, vintage) — the key the acquire cache is
    indexed on, so a re-run knows what it already has without touching the network.
    """

    source_id: str
    layer: str
    vintage: str
    url: str
    # Which slice of the layer this is — a state code for per-state files, None for
    # national ones. Part of the cache key, so two states never collide.
    scope: str | None = None

    @property
    def key(self) -> str:
        if self.scope:
            return f"{self.layer}:{self.scope}@{self.vintage}"
        return f"{self.layer}@{self.vintage}"


@dataclass(frozen=True)
class Release:
    """A fetched file on local disk, content-addressed and immutable."""

    ref: ReleaseRef
    path: Path
    sha256: str
    size_bytes: int
    fetched_at: datetime
    from_cache: bool = False

    @property
    def dir(self) -> Path:
        return self.path.parent


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def _index_path(raw_dir: Path, source_id: str) -> Path:
    return raw_dir / source_id / "index.json"


def _read_index(raw_dir: Path, source_id: str) -> dict[str, str]:
    path = _index_path(raw_dir, source_id)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        # A truncated index costs a re-download, not a crash.
        return {}
    return data if isinstance(data, dict) else {}


def _write_index(raw_dir: Path, source_id: str, index: dict[str, str]) -> None:
    path = _index_path(raw_dir, source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n")


class SourceAdapter(ABC):
    """One public data source.

    Subclasses declare the releases available for a vintage; ``fetch`` is inherited so
    every source caches, retries, and records provenance the same way.
    """

    source_id: ClassVar[str]
    default_vintage: ClassVar[str]

    @abstractmethod
    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """The releases this source offers for a vintage, without fetching them."""

    def fetch_all(
        self, *, raw_dir: Path, vintage: str | None = None, force: bool = False
    ) -> Iterator[Release]:
        """Fetch every ref for a vintage, yielding as each completes.

        Yields rather than returning a list so a caller can report progress on a 529MB
        download instead of going silent for two minutes.
        """
        for ref in self.refs(vintage):
            yield self.fetch(ref, raw_dir=raw_dir, force=force)

    def fetch(self, ref: ReleaseRef, *, raw_dir: Path, force: bool = False) -> Release:
        """Download one release, or return a cached copy without touching the network."""
        index = _read_index(raw_dir, ref.source_id)

        if not force and (cached_sha := index.get(ref.key)):
            release = self._from_cache(ref, raw_dir, cached_sha)
            if release is not None:
                return release

        with tempfile.TemporaryDirectory(prefix="hip-acquire-") as tmp:
            staged = Path(tmp) / Path(ref.url).name
            self._download(ref, staged)
            sha = _sha256(staged)
            size = staged.stat().st_size

            destination = raw_dir / ref.source_id / sha[:16]
            final = destination / staged.name
            if not final.exists():
                destination.mkdir(parents=True, exist_ok=True)
                shutil.move(str(staged), final)

        release = Release(
            ref=ref,
            path=final,
            sha256=sha,
            size_bytes=size,
            fetched_at=datetime.now(UTC),
        )
        self._write_manifest(release)
        index[ref.key] = sha
        _write_index(raw_dir, ref.source_id, index)
        return release

    def _from_cache(self, ref: ReleaseRef, raw_dir: Path, sha: str) -> Release | None:
        """Rebuild a Release from a previous fetch, or None if the file is gone."""
        manifest = raw_dir / ref.source_id / sha[:16] / "manifest.json"
        if not manifest.exists():
            return None
        data = json.loads(manifest.read_text())
        path = manifest.parent / data["filename"]
        if not path.exists():
            return None
        return Release(
            ref=ref,
            path=path,
            sha256=sha,
            size_bytes=data["size_bytes"],
            fetched_at=datetime.fromisoformat(data["fetched_at"]),
            from_cache=True,
        )

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """Transfer one file to ``destination``. The only overridable I/O primitive.

        Subclasses replace this, not ``_download`` — retry and error wrapping live one
        level up so every adapter inherits them rather than reimplementing them.
        """
        with httpx.stream(
            "GET", ref.url, timeout=_TIMEOUT, follow_redirects=True
        ) as response:
            response.raise_for_status()
            with destination.open("wb") as handle:
                for chunk in response.iter_bytes(CHUNK_BYTES):
                    handle.write(chunk)

    def _download(self, ref: ReleaseRef, destination: Path) -> None:
        """Retry ``_fetch_bytes``, then fail with a message naming source and layer."""
        last: Exception | None = None
        for attempt in range(1, _RETRIES + 1):
            try:
                self._fetch_bytes(ref, destination)
                return
            except (httpx.HTTPError, OSError) as exc:
                last = exc
                # A partial file must never be hashed and cached as if complete.
                destination.unlink(missing_ok=True)
                if attempt == _RETRIES:
                    break
        raise SourceError(
            f"{ref.source_id}/{ref.layer} ({ref.vintage}): "
            f"failed after {_RETRIES} attempts: {last}"
        ) from last

    def _write_manifest(self, release: Release) -> None:
        manifest = {
            **asdict(release.ref),
            "filename": release.path.name,
            "sha256": release.sha256,
            "size_bytes": release.size_bytes,
            "fetched_at": release.fetched_at.isoformat(),
        }
        (release.dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n"
        )
