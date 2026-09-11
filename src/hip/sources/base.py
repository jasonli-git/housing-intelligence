"""Source adapter protocol and the shared download machinery.

Every public source is reached through one adapter. Adapters declare *what* to fetch;
this module does the fetching, so retry, caching, content addressing, and manifest
writing are implemented once and behave identically for every source.

Raw downloads are immutable and content-addressed (ARCHITECTURE #10): a file lands at
``data/raw/<source_id>/<sha256[:16]>/<filename>`` and is never overwritten. Re-fetching
an unchanged upstream file produces the same directory and no new release.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import tempfile
import time
from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlsplit

import httpx

CHUNK_BYTES = 1 << 20
_TIMEOUT = httpx.Timeout(30.0, read=300.0)
_RETRIES = 3

# Query parameters that carry a credential. Census and FRED accept a key *only* as a
# query parameter — there is no header form to move it to — so the key is unavoidably
# part of the request URL and the defence has to be at the recording boundary instead.
# Longest first, so `api_key` is matched before `key` could match its tail.
_SECRET_PARAMS = ("registrationkey", "access_token", "api_key", "apikey", "token", "key")
_SECRET_PATTERN = re.compile(
    r"\b(" + "|".join(_SECRET_PARAMS) + r")=[^&\s\"'\]}]*", re.IGNORECASE
)


def redact(text: str) -> str:
    """Blank out any credential query parameter in a URL or a message.

    Applied everywhere a URL is written down or shown: the release manifest, the
    on-disk filename, and the text of a failed download. Before this, three sources
    put their key in the request URL and the URL was recorded verbatim — so
    `data/raw/` held 32 manifests quoting a live key and files literally *named*
    `...?registrationkey=<key>`, where a screenshot, a backup, or a stray `find` would
    carry it out of the machine (#76).
    """
    return _SECRET_PATTERN.sub(lambda m: f"{m.group(1)}=***", text)


class SourceError(Exception):
    """A source could not be fetched. Carries the source and layer that failed."""


# How long to wait after HTTP 429 when the publisher sends no usable `Retry-After`: one
# minute, the window HUD's limit is counted over, and the cap on any wait it asks for.
_RATE_LIMIT_WAIT_S = 60.0


def _rate_limit_wait(exc: BaseException) -> float:
    """Seconds to wait before retrying `exc`: `Retry-After` for a 429, else none."""
    if not isinstance(exc, httpx.HTTPStatusError) or exc.response.status_code != 429:
        return 0.0
    try:
        return min(float(exc.response.headers.get("retry-after", "")), _RATE_LIMIT_WAIT_S)
    except ValueError:
        # Absent, or an HTTP date rather than seconds: wait out the whole window.
        return _RATE_LIMIT_WAIT_S


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
    # What kind of file this source ships, so the landing stage knows how to transcode
    # it. A property of the publisher's format, which is the adapter's business.
    landing_format: ClassVar[str] = "csv"
    # Several federal hosts (notably download.bls.gov) reject requests with no
    # identifying User-Agent. Sending one is what they ask for, not evasion.
    # Not a ClassVar: an adapter needing per-instance auth (HUD's bearer token)
    # overrides this on the instance.
    headers: dict[str, str] = {
        "User-Agent": "housing-intelligence/0.2 (public data research)"
    }
    # Extra arguments for DuckDB's read_csv, for publishers whose files are not a
    # plain single-header CSV. Census Building Permits ships two header rows, which
    # collapse into one unusable column unless both are skipped.
    csv_read_options: ClassVar[str] = ""
    # Seconds to leave between this adapter's downloads; cached releases never wait.
    # Zero for publishers that state no limit. HUD User answers 429 past 60 requests a
    # minute (`x-ratelimit-limit: 60`), which 571 municipal CHAS calls reach in about
    # 100 — found on 2026-09-11, when the first run stopped at release 101.
    request_interval_s: ClassVar[float] = 0.0
    # When this adapter last sent a request, for `request_interval_s`.
    _last_request_at: float | None = None

    @abstractmethod
    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """The releases this source offers for a vintage, without fetching them."""

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        """What the downloaded file is called on disk.

        The last path segment of the URL for a source that serves files. An adapter
        that assembles its release from many API calls has no such segment and names
        the result itself. Cached releases keep the name recorded in their manifest,
        so overriding this never invalidates an existing download.

        The query string is dropped rather than sanitised. A file serves its bytes,
        not its parameters, and for the three sources that authenticate by query
        parameter the alternative was a filename containing a live credential (#76).
        What remains is still the meaningful part: `acs5` for Census, `observations`
        for FRED, the series id for BLS.
        """
        return Path(urlsplit(ref.url).path).name or "download"

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        """Flatten a JSON payload into rows, for sources whose API returns JSON.

        Only called when ``landing_format == "json"``. Every JSON API shapes its
        response differently — Census returns a matrix with a header row, FRED a list
        under one key, BLS a doubly-nested series structure — and that shape is the
        adapter's knowledge, not the landing stage's. Landing stays dumb by asking the
        adapter rather than by branching on source id.
        """
        raise NotImplementedError(
            f"{cls.__name__} lands JSON but does not implement to_records()"
        )

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
            staged = Path(tmp) / self.filename(ref)
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
            "GET",
            ref.url,
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers=self.headers,
        ) as response:
            response.raise_for_status()
            with destination.open("wb") as handle:
                for chunk in response.iter_bytes(CHUNK_BYTES):
                    handle.write(chunk)

    def _pace(self) -> None:
        """Wait out `request_interval_s` since this adapter's previous request."""
        if self.request_interval_s <= 0:
            return
        if self._last_request_at is not None:
            wait = self.request_interval_s - (time.monotonic() - self._last_request_at)
            if wait > 0:
                time.sleep(wait)
        self._last_request_at = time.monotonic()

    def _download(self, ref: ReleaseRef, destination: Path) -> None:
        """Retry ``_fetch_bytes``, then fail with a message naming source and layer.

        A retry is immediate, except after HTTP 429: the publisher has said to slow
        down, and three instant retries only spend the attempts inside the same window.
        """
        last: Exception | None = None
        for attempt in range(1, _RETRIES + 1):
            self._pace()
            try:
                self._fetch_bytes(ref, destination)
                return
            except (httpx.HTTPError, OSError) as exc:
                last = exc
                # A partial file must never be hashed and cached as if complete.
                destination.unlink(missing_ok=True)
                if attempt == _RETRIES:
                    break
                if wait := _rate_limit_wait(exc):
                    time.sleep(wait)
        # Raised `from None`, not `from last`: httpx renders the failing URL into both
        # its message and its traceback, and for a keyed source that URL carries the
        # key. The type and the redacted message are kept, so nothing diagnostic is
        # lost — only the chained traceback that would have reprinted the credential.
        detail = f"{type(last).__name__}: {redact(str(last))}" if last else "unknown"
        raise SourceError(
            f"{ref.source_id}/{ref.layer} ({ref.vintage}): "
            f"failed after {_RETRIES} attempts: {detail}"
        ) from None

    def _write_manifest(self, release: Release) -> None:
        manifest = {
            **asdict(release.ref),
            # The one field that can carry a credential (#76). Redacted rather than
            # dropped: which endpoint a release came from is real provenance, and the
            # key is not part of it.
            "url": redact(release.ref.url),
            "filename": release.path.name,
            "sha256": release.sha256,
            "size_bytes": release.size_bytes,
            "fetched_at": release.fetched_at.isoformat(),
        }
        (release.dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n"
        )
