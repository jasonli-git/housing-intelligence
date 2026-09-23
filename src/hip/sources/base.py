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
import logging
import re
import shutil
import tempfile
import time
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator
from dataclasses import asdict, dataclass, replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import ClassVar, Literal
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger(__name__)

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

    @property
    def mutable(self) -> bool:
        """Whether the publisher may replace this release's bytes at the same URL.

        A dated vintage names one release — ACS 2024, PEP 2025, SR1A's closed years —
        and the content-addressed cache is right to answer from disk forever. Two
        vintage spellings do not name a release at all:

        * ``current`` names *whatever is newest*, which Zillow, FRED, FHFA, BLS, HUD
          and MOD-IV all replace in place;
        * ``<year>ytd`` names a year still filling, which is SR1A's year-to-date file.

        Those have to be revalidated or they freeze silently. Derived from the vintage
        rather than declared per adapter, because the vintage string is already the
        thing that says whether a release is pinned — and deriving it means SR1A's
        ``2026ytd`` was covered the day it was written, without anyone remembering to
        set a flag.
        """
        return self.vintage == "current" or self.vintage.endswith("ytd")


@dataclass(frozen=True)
class Release:
    """A fetched file on local disk, content-addressed and immutable."""

    ref: ReleaseRef
    path: Path
    sha256: str
    size_bytes: int
    fetched_at: datetime
    from_cache: bool = False
    # What the publisher said identifies this version of the file, for the conditional
    # request that asks whether it has changed. Absent for a release assembled from
    # many API calls, which has no single response to validate against.
    last_modified: str | None = None
    etag: str | None = None
    # Set only when a conditional request returned 304: the publisher was reached and
    # said the bytes are unchanged.
    revalidated_at: datetime | None = None
    # Whether the publisher was reached, when one was asked. "unreachable" keeps the
    # cached bytes — that is the right thing to serve — but it is emphatically not
    # "unchanged": nobody knows whether it changed. Conflating the two let an outage
    # report as a confirmed cache hit and exit 0, which is the defect this field exists
    # to make impossible to express.
    revalidation: Literal["confirmed", "unreachable", "not_asked"] = "not_asked"

    @property
    def validators(self) -> dict[str, str]:
        """The request headers that ask "has this changed since I last looked?"."""
        headers = {}
        if self.etag:
            headers["If-None-Match"] = self.etag
        if self.last_modified:
            headers["If-Modified-Since"] = self.last_modified
        return headers

    @property
    def dir(self) -> Path:
        return self.path.parent


@dataclass(frozen=True)
class Discovery:
    """What acquisition learned about the newest release a publisher offers.

    Recorded beside the raw cache, in `data/raw/<source_id>/releases.json`, because the
    stages after acquisition rebuild each source's refs offline (#197). If they probed
    for themselves, a publisher releasing between `acquire` and `load` would hand the
    load a vintage acquisition never fetched. So acquisition asks once, writes down the
    answer, and every later stage reads it.

    `newest` is the newest release *in force*. A release that is published but not yet
    in force — HUD publishes a fiscal year's Fair Market Rents weeks before 1 October —
    is `pending`, with the day it starts, so it can be reported without being used.
    """

    source_id: str
    newest: str
    checked_at: datetime
    # "unreachable": a probe could not reach the publisher, so `newest` is the last
    # recorded answer rather than a fresh one — the distinction `Release.revalidation`
    # keeps, for the same reason: an outage must not read as "nothing new".
    outcome: Literal["confirmed", "unreachable"] = "confirmed"
    # When the publisher last changed the newest release's file, if it says. Distinct
    # from the period the release describes and from when it takes effect.
    published: str | None = None
    pending: str | None = None
    pending_from: date | None = None
    # Why a pending release is waiting, when it is not simply a start date.
    pending_reason: str | None = None


def _discovery_path(raw_dir: Path, source_id: str) -> Path:
    return raw_dir / source_id / "releases.json"


def read_discovery(raw_dir: Path, source_id: str) -> Discovery | None:
    """The newest release acquisition last recorded for a source, or None."""
    path = _discovery_path(raw_dir, source_id)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        return Discovery(
            source_id=data["source_id"],
            newest=data["newest"],
            checked_at=datetime.fromisoformat(data["checked_at"]),
            outcome=data.get("outcome", "confirmed"),
            published=data.get("published"),
            pending=data.get("pending"),
            pending_from=(
                date.fromisoformat(data["pending_from"])
                if data.get("pending_from")
                else None
            ),
            pending_reason=data.get("pending_reason"),
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        # A damaged record costs a fresh probe, not a crash — and until then the
        # adapter answers with its floor, which is a release known to exist.
        return None


def write_discovery(raw_dir: Path, discovery: Discovery) -> None:
    """Record what acquisition found. An unreachable probe keeps the last good record."""
    if discovery.outcome == "unreachable":
        return
    path = _discovery_path(raw_dir, discovery.source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        **asdict(discovery),
        "checked_at": discovery.checked_at.isoformat(),
        "pending_from": discovery.pending_from.isoformat()
        if discovery.pending_from
        else None,
    }
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")


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
    # Field layout for a fixed-width source: (name, one-based start, length). Pure
    # publisher knowledge, like `csv_read_options`, so it sits beside it rather than
    # behind a method. Empty for every source that is not fixed-width.
    fixed_width_fields: ClassVar[tuple[tuple[str, int, int], ...]] = ()
    # Seconds to leave between this adapter's downloads; cached releases never wait.
    # Zero for publishers that state no limit. HUD User answers 429 past 60 requests a
    # minute (`x-ratelimit-limit: 60`), which 571 municipal CHAS calls reach in about
    # 100 — found on 2026-09-11, when the first run stopped at release 101.
    request_interval_s: ClassVar[float] = 0.0
    # When this adapter last sent a request, for `request_interval_s`.
    _last_request_at: float | None = None
    # The validators from this adapter's most recent download, for `fetch` to record.
    # An adapter overriding `_fetch_bytes` leaves this None and is re-fetched in full.
    _last_validators: dict[str, str] | None = None
    # How long a mutable release may be answered from disk when the publisher offers no
    # validator to check it against. A week: long enough that a daily run costs nothing
    # on a monthly-published source, short enough that the site is never more than a
    # week behind a publisher that gave us no way to ask. Raise it on an adapter whose
    # refs are expensive — HUD's CHAS layer is 571 requests — and it has no effect at
    # all on a source that does send validators, which is checked every run for free.
    revalidate_after: ClassVar[timedelta] = timedelta(days=7)
    # The newest release in force, as acquisition last recorded it (`Discovery`). None
    # until something is recorded, when an adapter answers with its own floor — a
    # release known to exist when the adapter was written. Set from the record by
    # `hip.sources.registry.build_adapter`, and by `discover` itself during acquisition.
    newest: str | None = None
    # A transport for discovery probes, so tests drive the real probing logic against a
    # stub publisher rather than mocking the decision out. None means the network.
    probe_transport: httpx.BaseTransport | None = None

    @abstractmethod
    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """The releases this source offers for a vintage, without fetching them."""

    def discover(self, today: date) -> Discovery | None:
        """Ask the publisher for releases newer than the newest recorded one.

        None for a source with nothing to discover: one whose vintage is `current`,
        where the publisher replaces the file in place and revalidation (#188) already
        notices, or one pinned on purpose. Every source whose releases are *dated* —
        a year, a fiscal year, a survey vintage — overrides this, because a dated vintage
        is answered from disk forever and so is never re-asked: without discovery,
        `hip refresh` could revalidate every file it already had and still never learn
        that a newer year had been published. Measured 2026-09-23: Building Permits had
        published 2025, IRS migration 2022–23 and HUD income limits FY2026, and the
        platform requested none of them.

        `today` is passed in rather than read from the clock, so a probe's answer about
        what is *in force* is reproducible in a test.
        """
        return None

    def _discovered(
        self,
        newest: str,
        *,
        reached: bool,
        published: str | None = None,
        pending: str | None = None,
        pending_from: date | None = None,
        pending_reason: str | None = None,
    ) -> Discovery:
        """A `Discovery` for this source, stamped now."""
        return Discovery(
            source_id=self.source_id,
            newest=newest,
            checked_at=datetime.now(UTC),
            outcome="confirmed" if reached else "unreachable",
            published=published,
            pending=pending,
            pending_from=pending_from,
            pending_reason=pending_reason,
        )

    def _probe(self, url: str, *, method: str = "HEAD") -> tuple[bool | None, str | None]:
        """Whether `url` names a published release, and when it last changed.

        True for a 2xx, False for the answers publishers give for a release that does
        not exist yet — 404 from a file host, 400 "Invalid year" from HUD's API, 410 —
        and None for anything else, which means the publisher could not be asked. None is
        not False for the same reason it is not in `_revalidate`: "could not tell" must
        not read as "nothing newer".
        """
        response = self._ask(url, method=method)
        if response is None:
            return None, None
        if response.is_success:
            return True, response.headers.get("last-modified")
        if response.status_code in (400, 404, 410):
            return False, None
        return None, None

    def _ask(self, url: str, *, method: str = "GET") -> httpx.Response | None:
        """One paced request for discovery, or None when the publisher cannot be reached.

        The body is read, so a source whose answer is in the content — HUD's CHAS
        endpoint says "not published" with an empty list and a 200 — can decide from it.
        Discovery asks small things: a HEAD, a JSON stub, one short workbook.
        """
        self._pace()
        try:
            with httpx.Client(
                transport=self.probe_transport,
                timeout=_TIMEOUT,
                follow_redirects=True,
                headers=self.headers,
            ) as client:
                return client.request(method, url)
        except (httpx.HTTPError, OSError) as exc:
            logger.warning(
                "%s: could not probe %s (%s)",
                self.source_id,
                redact(url),
                type(exc).__name__,
            )
            return None

    def _probe_forward(
        self, start: int, exists: Callable[[int], tuple[bool | None, str | None]]
    ) -> tuple[int, str | None, bool]:
        """The newest year at or after `start` that `exists`, probing upward.

        `start` is a release already known to exist, so probing begins at the year
        after it and stops at the first absence. Returns that year, when the publisher
        last changed it (if it said, and if a newer year was found), and whether every
        answer was actually received. Three years ahead is the ceiling: no publisher
        here releases faster than yearly, and an unbounded loop against a host that
        answers 200 for anything would never end.
        """
        newest, published = start, None
        for year in range(start + 1, start + 4):
            found, modified = exists(year)
            if found is None:
                return newest, published, False
            if not found:
                break
            newest, published = year, modified
        return newest, published, True

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

    def landing_sheet(self, ref: ReleaseRef) -> str:
        """Which worksheet a release lands from, for sources published as workbooks.

        Only called when ``landing_format == "xlsx"``. Same division as `to_records`:
        a publisher's sheet names are the adapter's knowledge, and landing asks rather
        than branching on source id.
        """
        raise NotImplementedError(
            f"{type(self).__name__} lands xlsx but does not implement landing_sheet()"
        )

    def child_refs(
        self, release: Release, vintage: str | None = None
    ) -> list[ReleaseRef]:
        """Refs that only exist once `release` has been fetched.

        Some sources publish a directory and then one file per entry in it: HUD's CHAS
        layer lists New Jersey's municipalities in a file, and the 571 municipal refs
        can only be named after that file is on disk.

        This is a hook rather than an override of `fetch_all` because acquisition now
        has two callers. `fetch_all` is the strict one; `hip.refresh.acquire` is the
        resilient one, and it drives `refs()` and `fetch()` directly so it can carry on
        past a failure. When the expansion lived inside an overridden `fetch_all`, the
        resilient path silently skipped every municipal CHAS file — 22 hud_chas refs
        acquired where there should have been 593, and nothing said so. Declared here,
        both paths get it.
        """
        return []

    def fetch_all(
        self,
        *,
        raw_dir: Path,
        vintage: str | None = None,
        force: bool = False,
        cached_only: bool = False,
    ) -> Iterator[Release]:
        """Fetch every ref for a vintage, yielding as each completes.

        Yields rather than returning a list so a caller can report progress on a 529MB
        download instead of going silent for two minutes.
        """
        for ref in self.refs(vintage):
            release = self.fetch(
                ref, raw_dir=raw_dir, force=force, cached_only=cached_only
            )
            yield release
            for child in self.child_refs(release, vintage):
                yield self.fetch(
                    child, raw_dir=raw_dir, force=force, cached_only=cached_only
                )

    def fetch(
        self,
        ref: ReleaseRef,
        *,
        raw_dir: Path,
        force: bool = False,
        cached_only: bool = False,
    ) -> Release:
        """Download one release, or answer from cache when nothing upstream has moved.

        A pinned vintage is answered from disk without a request: it names one release
        and that release cannot change. A mutable ref — `current`, or a year-to-date
        file — is *revalidated*, because answering it from disk unconditionally is what
        froze the platform. Measured 2026-09-20: the deployed site served Zillow data
        fetched 2026-09-06 while Zillow had republished on 2026-09-16, and a full
        `make pipeline` reported "172 cached, 0 downloaded" without asking anyone.

        A 304 is a cache hit, so the common case still costs no transfer and the
        content-addressed copy on disk is kept exactly as it was. Only a publisher
        saying "changed" causes a download, which is the difference between this and
        `--force`: that re-downloads all 172 refs to find the seven that moved, and
        earned a 429 from HUD doing it.
        """
        index = _read_index(raw_dir, ref.source_id)

        if cached_only:
            # Answer from disk or fail; never touch the network. The stages after
            # acquisition run in this mode so that a run's release set is *pinned*: a
            # mutable publisher republishing between `land` and `load` would otherwise
            # stage values from one release and cite another, and every downstream stage
            # would pay for a second round of conditional requests to learn what
            # acquisition already knows.
            cached = index.get(ref.key)
            release = self._from_cache(ref, raw_dir, cached) if cached else None
            if release is None:
                raise SourceError(
                    f"{ref.source_id}/{ref.key}: not in the local cache, and this stage "
                    f"does not fetch. Run `hip acquire` first."
                )
            return release

        if not force and (cached_sha := index.get(ref.key)):
            release = self._from_cache(ref, raw_dir, cached_sha)
            if release is not None:
                if not ref.mutable:
                    return release
                if not release.validators:
                    # Nothing to ask with, so fall back to age. Some publishers send no
                    # validators at all — FHFA sends neither, and the JSON APIs behind
                    # Census, FRED, BLS and HUD send nothing useful — and every manifest
                    # written before validators were recorded is in the same state.
                    #
                    # Re-fetching those unconditionally would be worse than the defect
                    # it fixes: HUD's 571 municipal CHAS calls would run on every
                    # `hip acquire` and earn the 429 that stopped Milestone 21's first
                    # run. Keeping them forever is the freeze. So a mutable ref that
                    # cannot be checked is re-fetched once it is older than
                    # `revalidate_after`, which bounds staleness without asking every
                    # time.
                    if self._age(release) < self.revalidate_after:
                        return release
                else:
                    answer = self._revalidate(release)
                    if answer is True:
                        return replace(
                            release,
                            revalidated_at=datetime.now(UTC),
                            revalidation="confirmed",
                        )
                    if answer is None:
                        # Reached nobody. The cached bytes still stand — discarding
                        # good data because a publisher is down would be worse — but
                        # this is an *unknown*, not a confirmed cache hit, and the run
                        # has to be able to say so.
                        return replace(release, revalidation="unreachable")

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

        validators = self._last_validators or {}
        release = Release(
            ref=ref,
            path=final,
            sha256=sha,
            size_bytes=size,
            fetched_at=datetime.now(UTC),
            last_modified=validators.get("last-modified"),
            etag=validators.get("etag"),
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
            # Absent from every manifest written before this existed, which is why the
            # first refresh after it lands re-downloads a mutable ref once and records
            # them. After that the check is free.
            last_modified=data.get("last_modified"),
            etag=data.get("etag"),
        )

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """Transfer one file to ``destination``. The only overridable I/O primitive.

        Subclasses replace this, not ``_download`` — retry and error wrapping live one
        level up so every adapter inherits them rather than reimplementing them.

        This implementation also records the response's `Last-Modified` and `ETag` on
        the instance, which `fetch` writes into the manifest so a later run can ask the
        publisher whether anything moved. An adapter that overrides this and assembles
        a release from many requests simply leaves them unset — there is no single
        response to validate against, and such a release is re-fetched every time
        rather than pretending it can be checked cheaply.
        """
        with httpx.stream(
            "GET",
            ref.url,
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers=self.headers,
        ) as response:
            response.raise_for_status()
            self._last_validators = {
                name: value
                for name in ("last-modified", "etag")
                if (value := response.headers.get(name))
            }
            with destination.open("wb") as handle:
                for chunk in response.iter_bytes(CHUNK_BYTES):
                    handle.write(chunk)

    @staticmethod
    def _age(release: Release) -> timedelta:
        """How long since this release was fetched."""
        return datetime.now(UTC) - release.fetched_at

    def _revalidate(self, release: Release) -> bool | None:
        """Ask the publisher whether a cached release's bytes have changed.

        Returns True for unchanged, False for changed, and None for "could not tell",
        which means the publisher could not be reached. None is deliberately not False:
        a refresh that cannot reach a publisher should keep serving what it has rather
        than discard a good cached copy, and should say so rather than quietly
        re-downloading.

        Only called once there is something to ask with. A cached release carrying no
        validators is re-fetched instead — see `fetch`.

        The conditional request is a GET, not a HEAD, because 304 is specified for GET
        and some publishers answer a conditional HEAD with 200 regardless. Nothing is
        transferred either way: on 304 there is no body, and on 200 the stream is
        closed before it is read, so the cost of finding out is a connection rather
        than the 76MB Zillow file behind it.
        """
        if not (validators := release.validators):
            return None
        try:
            self._pace()
            with httpx.stream(
                "GET",
                release.ref.url,
                timeout=_TIMEOUT,
                follow_redirects=True,
                headers={**self.headers, **validators},
            ) as response:
                if response.status_code == 304:
                    return True
                response.raise_for_status()
                return False
        except (httpx.HTTPError, OSError) as exc:
            logger.warning(
                "%s/%s: could not revalidate (%s); keeping the cached copy",
                release.ref.source_id,
                release.ref.key,
                type(exc).__name__,
            )
            return None

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
            # What a later run sends back to ask whether this has changed. Omitted
            # rather than written null when the publisher offered neither.
            **({"last_modified": release.last_modified} if release.last_modified else {}),
            **({"etag": release.etag} if release.etag else {}),
        }
        (release.dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n"
        )
