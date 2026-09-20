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

from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
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
    def downloaded(self) -> list[Release]:
        """Refs whose bytes actually moved — the ones that changed upstream."""
        return [r for r in self.releases if not r.from_cache]

    @property
    def revalidated(self) -> list[Release]:
        """Refs the publisher was asked about and called unchanged.

        Kept apart from `unchecked` deliberately. Both are cache hits and only one of
        them is evidence that the platform is current.
        """
        return [r for r in self.releases if r.from_cache and r.revalidated_at]

    @property
    def unchecked(self) -> list[Release]:
        """Cache hits nobody asked about: a pinned vintage, or a ref with no validator
        that is not yet old enough to re-fetch on age alone."""
        return [r for r in self.releases if r.from_cache and not r.revalidated_at]

    @property
    def total_bytes(self) -> int:
        return sum(r.size_bytes for r in self.releases)

    @property
    def ok(self) -> bool:
        return not self.failures


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
                yield adapter, adapter.fetch(ref, raw_dir=raw_dir, force=force)
            except (SourceError, OSError) as exc:
                yield adapter, RefFailure.of(adapter.source_id, ref.key, exc)


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


__all__ = ["AcquireReport", "RefFailure", "ReleaseRef", "acquire", "collect"]
