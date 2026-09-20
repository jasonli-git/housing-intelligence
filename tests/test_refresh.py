"""One publisher's bad day must not end an unattended run.

`fetch_all` raises, on purpose: an interactive `hip acquire -s zillow_zhvi` should fail
loudly. A refresh runs against twelve publishers and cannot. On 2026-09-06 a HUD 429
ended a full run partway through, and `census_permits.py` still carries a docstring
promising per-ref isolation that `fetch_all` never provided.
"""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

import pytest

from hip import refresh
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError


class Flaky(SourceAdapter):
    """Three refs, of which the middle one fails."""

    source_id: ClassVar[str] = "flaky"
    default_vintage: ClassVar[str] = "2025"

    def __init__(self, *, failing: str = "b", refs_raise: bool = False) -> None:
        self.failing = failing
        self.refs_raise = refs_raise
        self.attempted: list[str] = []

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if self.refs_raise:
            raise SourceError("flaky: the directory listing itself failed")
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=layer,
                vintage="2025",
                url=f"https://example.invalid/{layer}.csv",
            )
            for layer in ("a", "b", "c")
        ]

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        self.attempted.append(ref.layer)
        if ref.layer == self.failing:
            raise SourceError(f"flaky/{ref.layer}: 404 for a year not published yet")
        destination.write_bytes(b"col\n1\n")


def test_a_failing_ref_does_not_stop_the_ones_after_it(tmp_path: Path) -> None:
    adapter = Flaky()
    report = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))

    assert [r.ref.layer for r in report.releases] == ["a", "c"]
    assert [f.key for f in report.failures] == ["b@2025"]
    assert adapter.attempted == ["a", "b", "c"], "gave up instead of carrying on"
    assert not report.ok


def test_a_failing_ref_does_not_stop_the_next_source(tmp_path: Path) -> None:
    """The failure that actually happened: one publisher taking out eleven others."""
    first, second = Flaky(failing="a"), Flaky(failing="")
    report = refresh.collect(refresh.acquire([first, second], raw_dir=tmp_path))

    assert len(report.releases) == 5, "the second source did not run"
    assert len(report.failures) == 1


def test_a_source_that_cannot_even_list_its_refs_is_reported(tmp_path: Path) -> None:
    """`refs()` is not always pure — HudChasAdapter fetches to derive municipal refs."""
    report = refresh.collect(
        refresh.acquire([Flaky(refs_raise=True), Flaky(failing="")], raw_dir=tmp_path)
    )

    assert [f.key for f in report.failures] == ["refs()"]
    assert len(report.releases) == 3, "the healthy source did not run"


def test_a_failure_message_never_carries_a_credential(tmp_path: Path) -> None:
    """A keyed source's error text quotes its URL, and that URL quotes the key (#76)."""

    class Keyed(Flaky):
        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            raise SourceError("GET https://api.example.invalid/x?api_key=SECRET failed")

    report = refresh.collect(refresh.acquire([Keyed()], raw_dir=tmp_path))

    assert report.failures, "expected the failures this test is about"
    joined = " ".join(f.error for f in report.failures)
    assert "SECRET" not in joined
    assert "api_key=***" in joined


def test_the_report_separates_being_told_unchanged_from_never_asking(
    tmp_path: Path,
) -> None:
    """The distinction the old "172 cached" hid, and the reason it hid the defect.

    A pinned vintage is a cache hit nobody asked about, which is correct and is not
    evidence of anything. Only a ref the publisher was asked about and called unchanged
    says the platform is current.
    """
    adapter = Flaky(failing="")
    first = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    assert len(first.downloaded) == 3
    assert first.revalidated == [] and first.unchecked == []

    second = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    assert second.downloaded == []
    assert len(second.unchecked) == 3, "a dated vintage should not be revalidated"
    assert second.revalidated == []
    assert second.total_bytes == first.total_bytes
    assert second.ok


def test_force_is_still_force(tmp_path: Path) -> None:
    adapter = Flaky(failing="")
    refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    again = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path, force=True))

    assert len(again.downloaded) == 3


@pytest.mark.parametrize("failing", ["a", "b", "c"])
def test_whichever_ref_fails_the_others_still_land(tmp_path: Path, failing: str) -> None:
    report = refresh.collect(refresh.acquire([Flaky(failing=failing)], raw_dir=tmp_path))

    assert len(report.releases) == 2
    assert len(report.failures) == 1
