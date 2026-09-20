"""One publisher's bad day must not end an unattended run.

`fetch_all` raises, on purpose: an interactive `hip acquire -s zillow_zhvi` should fail
loudly. A refresh runs against twelve publishers and cannot. On 2026-09-06 a HUD 429
ended a full run partway through, and `census_permits.py` still carries a docstring
promising per-ref isolation that `fetch_all` never provided.
"""

from __future__ import annotations

import json
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
    assert len(first.fetched) == 3
    assert first.revalidated == [] and first.unchecked == []

    second = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    assert second.fetched == []
    assert len(second.unchecked) == 3, "a dated vintage should not be revalidated"
    assert second.revalidated == []
    assert second.total_bytes == first.total_bytes
    assert second.ok


def test_force_is_still_force(tmp_path: Path) -> None:
    adapter = Flaky(failing="")
    refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    again = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path, force=True))

    assert len(again.fetched) == 3


@pytest.mark.parametrize("failing", ["a", "b", "c"])
def test_whichever_ref_fails_the_others_still_land(tmp_path: Path, failing: str) -> None:
    report = refresh.collect(refresh.acquire([Flaky(failing=failing)], raw_dir=tmp_path))

    assert len(report.releases) == 2
    assert len(report.failures) == 1


def test_exit_codes_tell_a_scheduler_what_to_do() -> None:
    """Pass/fail is the wrong shape for the question a cron job asks.

    Fifteen sources moving while one publisher is down is a *successful* refresh whose
    numbers should still deploy — the same three-way split `hip explain` already uses
    for prose (ARCHITECTURE #102). Only a pipeline that could not complete is a failure,
    because then the warehouse is not consistent and nothing should ship from it.
    """
    clean = refresh.AcquireReport()
    partial = refresh.AcquireReport(
        failures=[refresh.RefFailure("hud", "county_34021@current", "429")]
    )

    assert (
        refresh.exit_code(clean, pipeline_ran=True, pipeline_ok=True) == refresh.EXIT_OK
    )
    assert (
        refresh.exit_code(partial, pipeline_ran=True, pipeline_ok=True)
        == refresh.EXIT_PARTIAL
    )
    # A broken pipeline outranks healthy sources: the warehouse is the thing that failed.
    assert (
        refresh.exit_code(clean, pipeline_ran=True, pipeline_ok=False)
        == refresh.EXIT_FAILED
    )
    assert (
        refresh.exit_code(partial, pipeline_ran=True, pipeline_ok=False)
        == refresh.EXIT_FAILED
    )
    # Nothing moved, so nothing ran, and that is a clean result rather than a skip.
    assert (
        refresh.exit_code(clean, pipeline_ran=False, pipeline_ok=True) == refresh.EXIT_OK
    )


def test_the_pipeline_order_is_the_one_make_documents() -> None:
    """`validate` gates the load, so it comes before it and after what it reads."""
    assert refresh.STAGES.index("validate") < refresh.STAGES.index("load")
    assert refresh.STAGES.index("stage") < refresh.STAGES.index("geocode")
    assert refresh.STAGES[0] == "land" and refresh.STAGES[-1] == "analyze"


def _raw_release(raw: Path, source: str, sha: str, *, size: int = 32) -> Path:
    d = raw / source / sha[:16]
    d.mkdir(parents=True, exist_ok=True)
    (d / "data.csv").write_bytes(b"x" * size)
    (d / "manifest.json").write_text(json.dumps({"sha256": sha, "filename": "data.csv"}))
    return d


def _index(raw: Path, source: str, mapping: dict[str, str]) -> None:
    (raw / source).mkdir(parents=True, exist_ok=True)
    (raw / source / "index.json").write_text(json.dumps(mapping))


def test_a_release_a_fact_cites_is_never_superseded(tmp_path: Path) -> None:
    """The rule that makes this a retention policy rather than "keep the newest".

    A warehouse row names the release its value was read from. Deleting that file would
    leave a published figure whose provenance points at nothing, which is the one thing
    the platform claims never happens.
    """
    old, new = "a" * 64, "b" * 64
    _raw_release(tmp_path, "zillow_zhvi", old)
    _raw_release(tmp_path, "zillow_zhvi", new)
    _index(tmp_path, "zillow_zhvi", {"county@current": new})

    assert refresh.superseded_releases(tmp_path, cited={old}) == []
    assert [s.sha256 for s in refresh.superseded_releases(tmp_path, cited=set())] == [old]


def test_the_current_release_is_never_superseded(tmp_path: Path) -> None:
    sha = "c" * 64
    _raw_release(tmp_path, "fred", sha)
    _index(tmp_path, "fred", {"MORTGAGE30US@current": sha})

    assert refresh.superseded_releases(tmp_path, cited=set()) == []


def test_an_unreadable_index_removes_nothing_from_that_source(tmp_path: Path) -> None:
    """Not knowing what is current is a reason to keep everything, not to guess."""
    _raw_release(tmp_path, "bls", "d" * 64)
    (tmp_path / "bls" / "index.json").write_text("{ truncated")

    assert refresh.superseded_releases(tmp_path, cited=set()) == []


def test_it_reports_size_so_a_caller_can_show_the_cost(tmp_path: Path) -> None:
    _raw_release(tmp_path, "zillow_zori", "e" * 64, size=1024)
    _index(tmp_path, "zillow_zori", {"county@current": "f" * 64})

    found = refresh.superseded_releases(tmp_path, cited=set())
    assert len(found) == 1 and found[0].size_bytes >= 1024
    assert found[0].path.exists(), "superseded_releases must not delete anything itself"


# --- Regressions for the review of PR #27 (2026-09-20) -----------------------------
#
# Acquisition was tested; the end-to-end guarantees around it were not, and five of
# them did not hold. Each test below is named for the false claim it stops.


def test_an_unreachable_publisher_is_not_reported_as_unchanged(tmp_path: Path) -> None:
    """The first version merged "told unchanged" with "could not ask", so an outage
    counted as a confirmed cache hit, recorded no failure, and exited 0."""

    class Flaps(Flaky):
        def __init__(self) -> None:
            super().__init__(failing="")
            self.reachable = True

        def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
            return [
                ReleaseRef(
                    source_id=self.source_id,
                    layer="a",
                    vintage="current",
                    url="https://example.invalid/a.csv",
                )
            ]

        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            destination.write_bytes(b"col\n1\n")
            self._last_validators = {"etag": '"v1"'}

        def _revalidate(self, release):  # type: ignore[no-untyped-def]
            return None if not self.reachable else True

    adapter = Flaps()
    refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))

    adapter.reachable = False
    report = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))

    assert len(report.unreachable) == 1
    assert report.revalidated == [], "an outage counted as confirmed unchanged"
    assert not report.ok
    assert (
        refresh.exit_code(report, pipeline_ran=True, pipeline_ok=True)
        == refresh.EXIT_PARTIAL
    ), "an outage exited 0"


def test_child_refs_are_acquired_by_the_resilient_path(tmp_path: Path) -> None:
    """Expansion lived in an overridden `fetch_all`, which this loop bypasses — so it
    silently stopped acquiring HUD's 571 municipal CHAS files, and the acquire log said
    22 hud_chas refs where there should have been 593."""

    class Directory(Flaky):
        def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
            return [
                ReleaseRef(
                    source_id=self.source_id,
                    layer="mcds",
                    vintage="2025",
                    url="https://example.invalid/mcds.json",
                )
            ]

        def child_refs(self, release, vintage=None):  # type: ignore[no-untyped-def]
            if release.ref.layer != "mcds":
                return []
            return [
                ReleaseRef(
                    source_id=self.source_id,
                    layer=f"mcd_{n}",
                    vintage="2025",
                    url=f"https://example.invalid/{n}.json",
                )
                for n in (1, 2)
            ]

    report = refresh.collect(refresh.acquire([Directory(failing="")], raw_dir=tmp_path))

    assert [r.ref.layer for r in report.releases] == ["mcds", "mcd_1", "mcd_2"]


def test_a_child_that_fails_does_not_take_its_siblings(tmp_path: Path) -> None:
    class Directory(Flaky):
        def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
            return [
                ReleaseRef(
                    source_id=self.source_id,
                    layer="mcds",
                    vintage="2025",
                    url="https://example.invalid/mcds.json",
                )
            ]

        def child_refs(self, release, vintage=None):  # type: ignore[no-untyped-def]
            if release.ref.layer != "mcds":
                return []
            return [
                ReleaseRef(
                    source_id=self.source_id,
                    layer=f"mcd_{n}",
                    vintage="2025",
                    url=f"https://example.invalid/{n}.json",
                )
                for n in (1, 2, 3)
            ]

    report = refresh.collect(
        refresh.acquire([Directory(failing="mcd_2")], raw_dir=tmp_path)
    )

    assert [r.ref.layer for r in report.releases] == ["mcds", "mcd_1", "mcd_3"]
    assert [f.key for f in report.failures] == ["mcd_2@2025"]


def test_identical_bytes_are_not_a_change(tmp_path: Path) -> None:
    """A source with no validator is re-fetched on age alone and usually returns exactly
    what it returned last time. That is a transfer, not a reason to rebuild everything."""
    adapter = Flaky(failing="")
    first = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    state = refresh.RefreshState()
    state.write(tmp_path, first.shas)

    again = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path, force=True))

    assert len(again.fetched) == 3, "expected a re-transfer, which is the premise"
    assert refresh.RefreshState.read(tmp_path).changed(again.shas) == [], (
        "identical bytes reported as an upstream change"
    )


def test_a_failed_pipeline_is_not_recorded_as_processed(tmp_path: Path) -> None:
    """The false all-clear. `fetch` records a download the moment the bytes land, so a
    run whose pipeline then failed left everything looking cached — and the next run
    exited 0 saying the warehouse already reflected every source. It did not."""
    adapter = Flaky(failing="")
    report = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))

    # The pipeline failed, so nothing is written. This is the whole fix.
    state = refresh.RefreshState.read(tmp_path)
    assert state.completed_at is None
    assert state.changed(report.shas) == sorted(report.shas), (
        "a run that never completed looked already-processed"
    )

    # The retry sees the same cached bytes and must still rebuild.
    retry = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    assert retry.fetched == [], "the premise: nothing to re-download"
    assert refresh.RefreshState.read(tmp_path).changed(retry.shas) != []

    # Only a completed run licenses the skip.
    refresh.RefreshState().write(tmp_path, retry.shas)
    assert refresh.RefreshState.read(tmp_path).changed(retry.shas) == []


def test_unreadable_state_forces_a_rebuild(tmp_path: Path) -> None:
    """Not knowing what was processed has to mean "process it", never "skip it"."""
    adapter = Flaky(failing="")
    report = refresh.collect(refresh.acquire([adapter], raw_dir=tmp_path))
    (tmp_path / refresh.STATE_FILE).write_text("{ truncated")

    assert refresh.RefreshState.read(tmp_path).changed(report.shas) != []
