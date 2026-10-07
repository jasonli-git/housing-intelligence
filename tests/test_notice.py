"""NOTICE lists every source the platform fetches (found 2026-10-06 listing 12 of 37)."""

from __future__ import annotations

from hip.config import REPO_ROOT, load_sources
from hip.notice import SOURCES_HEADING, render
from hip.sources.registry import PLANNED


def test_notice_is_generated_from_the_source_registry() -> None:
    current = (REPO_ROOT / "NOTICE").read_text()
    assert current == render(current, load_sources(), set(PLANNED)), (
        "NOTICE is out of date: run `hip notice`"
    )


def test_notice_lists_every_fetched_source_once_and_keeps_its_opening() -> None:
    sources = load_sources()
    current = (REPO_ROOT / "NOTICE").read_text()
    head, _, listed = current.partition(SOURCES_HEADING)
    assert "GNU Affero General Public License" in head
    names = [line[4:] for line in listed.splitlines() if line.startswith("### ")]
    expected = [
        s.name for sid, s in sources.items() if sid not in {"hip_derived", *PLANNED}
    ]
    assert sorted(names) == sorted(expected)
    assert len(names) == len(set(names))
