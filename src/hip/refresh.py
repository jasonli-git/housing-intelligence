"""Acquiring every source without letting one publisher's bad day end the run.

`SourceAdapter.fetch_all` is strict on purpose: it raises, because a single interactive
`hip acquire -s zillow_zhvi` should fail loudly. A *refresh* cannot behave that way. It
runs unattended against twelve publishers, and one of them returning a 404 for a year
that has not been published yet must not stop the other eleven — which is exactly what
happened on 2026-09-06, when a HUD 429 ended a full run partway through.

This module owns that difference. The adapters keep their strict primitive; resilience
and reporting live one level up, the same division that already puts retry and error
wrapping above `_fetch_bytes`.

**What the report is for.** A refresh that says "172 cached" tells you nothing about
whether the platform is current — that was literally true on the day the deployed site
was a Zillow release behind. The distinction that matters is between *asked and told
nothing changed* and *never asked*, so the report keeps them apart.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from hip.sources.base import Release, ReleaseRef, SourceAdapter, SourceError, redact


@dataclass(frozen=True)
class RefFailure:
    """One ref that could not be fetched, and why."""

    source_id: str
    key: str
    error: str

    @classmethod
    def of(cls, source_id: str, key: str, exc: BaseException) -> RefFailure:
        # `redact` because a keyed source's failure message carries its URL, and that
        # URL carries the key (#76). The type and the redacted text are kept.
        return cls(source_id, key, f"{type(exc).__name__}: {redact(str(exc))}")


@dataclass
class AcquireReport:
    """What one acquire run did, per outcome rather than per source."""

    releases: list[Release] = field(default_factory=list)
    failures: list[RefFailure] = field(default_factory=list)

    @property
    def fetched(self) -> list[Release]:
        """Refs whose bytes were transferred.

        Deliberately *not* called `downloaded`-means-`changed`. A source with no
        validator is re-fetched on age alone and very often returns byte-identical
        content, which is a transfer and not a change. Whether anything actually moved
        is `changed_shas`, which compares against what was last processed.
        """
        return [r for r in self.releases if not r.from_cache]

    @property
    def revalidated(self) -> list[Release]:
        """Refs the publisher was reached about and called unchanged.

        A confirmed 304 and nothing else. An outage is `unreachable`, because "nobody
        knows" is not "unchanged" — reporting the two the same way let a publisher being
        down look like a clean, current run.
        """
        return [r for r in self.releases if r.revalidation == "confirmed"]

    @property
    def unreachable(self) -> list[Release]:
        """Refs whose publisher could not be reached. The cached bytes still stand."""
        return [r for r in self.releases if r.revalidation == "unreachable"]

    @property
    def unchecked(self) -> list[Release]:
        """Cache hits nobody asked about: a pinned vintage, or a ref with no validator
        that is not yet old enough to re-fetch on age alone."""
        return [
            r for r in self.releases if r.from_cache and r.revalidation == "not_asked"
        ]

    @property
    def shas(self) -> dict[str, str]:
        """What is on disk now, as `source_id/ref.key` -> sha256."""
        return {f"{r.ref.source_id}/{r.ref.key}": r.sha256 for r in self.releases}

    @property
    def total_bytes(self) -> int:
        return sum(r.size_bytes for r in self.releases)

    @property
    def ok(self) -> bool:
        """Nothing failed, and nothing was left in an unknown state."""
        return not self.failures and not self.unreachable


def acquire(
    adapters: Iterable[SourceAdapter],
    *,
    raw_dir: Path,
    vintage: str | None = None,
    force: bool = False,
) -> Iterator[tuple[SourceAdapter, Release | RefFailure]]:
    """Fetch every ref of every adapter, yielding each outcome as it happens.

    Yields rather than returning so a caller can print progress against a 245MB
    download instead of going silent, which is why `fetch_all` yields too.

    Both loops are guarded. `refs()` is not always pure — `HudChasAdapter` derives its
    municipal refs from a release it fetches — so a publisher can fail before a single
    ref exists, and that must be reported as a failure rather than raised.
    """
    for adapter in adapters:
        try:
            refs = adapter.refs(vintage)
        except (SourceError, OSError) as exc:
            yield adapter, RefFailure.of(adapter.source_id, "refs()", exc)
            continue
        for ref in refs:
            try:
                release = adapter.fetch(ref, raw_dir=raw_dir, force=force)
            except (SourceError, OSError) as exc:
                yield adapter, RefFailure.of(adapter.source_id, ref.key, exc)
                continue
            yield adapter, release
            # Refs that only exist once their parent is on disk — HUD's 571 municipal
            # CHAS files are named by a directory this loop just fetched. Driving
            # `refs()` and `fetch()` directly is what makes this loop resilient, and it
            # is also what made it skip these entirely until `child_refs` existed.
            try:
                children = adapter.child_refs(release, vintage)
            except (SourceError, OSError, ValueError) as exc:
                yield (
                    adapter,
                    RefFailure.of(adapter.source_id, f"{ref.key}/children", exc),
                )
                continue
            for child in children:
                try:
                    yield adapter, adapter.fetch(child, raw_dir=raw_dir, force=force)
                except (SourceError, OSError) as exc:
                    yield adapter, RefFailure.of(adapter.source_id, child.key, exc)


def collect(
    outcomes: Iterable[tuple[SourceAdapter, Release | RefFailure]],
) -> AcquireReport:
    """Drain `acquire` into a report. Separate so a caller can print as it drains."""
    report = AcquireReport()
    for _, outcome in outcomes:
        if isinstance(outcome, RefFailure):
            report.failures.append(outcome)
        else:
            report.releases.append(outcome)
    return report


# What a scheduler reads. The same three-way split `hip explain` already uses
# (ARCHITECTURE #102), because the answer a cron job needs is not pass/fail: a refresh
# where fifteen sources moved and one publisher was down is a successful refresh whose
# numbers should still deploy.
EXIT_OK = 0
EXIT_FAILED = 1
EXIT_PARTIAL = 3

# The pipeline, in the order each stage's output is the next one's input. `validate` is
# a gate: a non-zero exit there stops the load, and must stop the refresh with it.
STAGES: tuple[str, ...] = (
    "land",
    "stage",
    "geocode",
    "validate",
    "load",
    "analyze",
)


def exit_code(report: AcquireReport, *, pipeline_ran: bool, pipeline_ok: bool) -> int:
    """What the run should exit with.

    A refresh that could not complete its pipeline is a failure, whatever the sources
    did. A refresh that completed with some sources unreachable is partial: the numbers
    are consistent and should deploy, but something needs a human eventually.

    "Unreachable" counts both ways a publisher can be out of contact — a ref that failed
    outright, and one whose revalidation could not reach anyone. The second used to be
    reported as a confirmed cache hit and exited 0, which made an outage look like a
    clean, current run.
    """
    if pipeline_ran and not pipeline_ok:
        return EXIT_FAILED
    if report.failures or report.unreachable:
        # An unreachable publisher is partial, not clean. The cached bytes were served,
        # which is right, but nobody knows whether they are current — and a run that
        # reports 0 for that is how an outage becomes invisible.
        return EXIT_PARTIAL
    return EXIT_OK


__all__ = [
    "EXIT_FAILED",
    "EXIT_OK",
    "EXIT_PARTIAL",
    "STAGES",
    "AcquireReport",
    "RefFailure",
    "ReleaseRef",
    "acquire",
    "collect",
    "STATE_FILE",
    "RefreshState",
    "Superseded",
    "exit_code",
    "superseded_releases",
]


@dataclass(frozen=True)
class Superseded:
    """One raw release directory nothing refers to any more."""

    source_id: str
    path: Path
    sha256: str
    size_bytes: int


def superseded_releases(raw_dir: Path, cited: set[str]) -> list[Superseded]:
    """Raw directories that are neither current for their ref nor cited by a fact.

    The raw tier is content-addressed and immutable (ARCHITECTURE #10), so a refresh
    never overwrites: it writes a second copy beside the first. That was harmless while
    acquisition was manual and a release only changed when someone re-ran by hand. Under
    a cadence it is unbounded — measured 2026-09-20, one refresh took `data/raw/` from
    264MB of superseded copies to 511MB across 59 directories, 459MB of it three earlier
    Zillow ZHVI files at about 76MB each.

    Two things are kept, and the second is the one that matters:

    * whatever the source index currently points at, which is what the next run answers
      from;
    * **every release a fact cites**, passed in as `cited`. A warehouse row names the
      release its value was read from, and deleting that file would leave a published
      figure whose provenance points at nothing. That is the whole claim of the platform,
      so the rule is a retention rule rather than a "keep the newest N".

    Nothing is deleted here. The caller decides, and `hip prune-raw` shows before it does.
    """
    found: list[Superseded] = []
    for index_path in sorted(raw_dir.glob("*/index.json")):
        source_dir = index_path.parent
        try:
            current = set(json.loads(index_path.read_text()).values())
        except (json.JSONDecodeError, OSError):
            # An unreadable index means we cannot tell what is current, so nothing in
            # this source is safe to remove.
            continue
        for candidate in sorted(source_dir.iterdir()):
            if not candidate.is_dir():
                continue
            manifest = candidate / "manifest.json"
            if not manifest.exists():
                continue
            try:
                sha = json.loads(manifest.read_text())["sha256"]
            except (json.JSONDecodeError, KeyError, OSError):
                continue
            if sha in current or sha in cited:
                continue
            size = sum(f.stat().st_size for f in candidate.rglob("*") if f.is_file())
            found.append(Superseded(source_dir.name, candidate, sha, size))
    return found


# Where the last *completed* refresh is recorded. Beside the raw tier because it
# describes what that tier held when the warehouse was last built from it.
STATE_FILE = "refresh-state.json"


@dataclass(frozen=True)
class RefreshState:
    """What the warehouse was last successfully built from.

    Acquisition and processing are separate steps with separate failure modes, and
    conflating them produced a false all-clear: `fetch` records a download in the raw
    index the moment the bytes land, so if `land`, `validate`, `load` or `analyze` then
    failed, the *next* run saw everything cached, concluded nothing had moved, and
    exited 0 saying "the warehouse already reflects every source". It did not. The
    previous run never finished.

    This is the missing half. The raw index says what was downloaded; this says what was
    downloaded **and processed all the way through**. A run is only allowed to skip the
    pipeline when the two agree.

    Keying on content rather than on "did we transfer bytes" also settles a second
    problem: a source with no validator is re-fetched on age alone and usually returns
    byte-identical content. That is a transfer, not a change, and rebuilding the whole
    warehouse for it defeats the point of asking.
    """

    completed_at: str | None = None
    processed: dict[str, str] = field(default_factory=dict)

    @classmethod
    def read(cls, raw_dir: Path) -> RefreshState:
        path = raw_dir / STATE_FILE
        if not path.exists():
            return cls()
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            # Unreadable state means "we do not know what was processed", which must
            # mean a full pipeline rather than a skip.
            return cls()
        return cls(
            completed_at=data.get("completed_at"),
            processed=dict(data.get("processed") or {}),
        )

    def write(self, raw_dir: Path, shas: dict[str, str]) -> None:
        """Record a completed run. Called only after every stage has succeeded."""
        raw_dir.mkdir(parents=True, exist_ok=True)
        (raw_dir / STATE_FILE).write_text(
            json.dumps(
                {
                    "completed_at": datetime.now(UTC).isoformat(),
                    "processed": dict(sorted(shas.items())),
                },
                indent=2,
            )
            + "\n"
        )

    def changed(self, shas: dict[str, str]) -> list[str]:
        """Which refs differ from what was last processed, newly present included.

        An empty list is the only thing that licenses skipping the pipeline, and it is
        false whenever the last run did not finish — because then `processed` is either
        empty or describes an older state of the disk.
        """
        return sorted(k for k, sha in shas.items() if self.processed.get(k) != sha)
