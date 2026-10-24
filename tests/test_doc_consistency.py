"""Hold `README.md` to what `ROADMAP.md` and `CHANGELOG.md` say has shipped.

Until 2026-10-21 every milestone marked ``✅ done`` had to be described in the README's
Features list, tagged ``(M<n>, built)``: the list had once lagged six shipped milestones
behind (2026-09-19). The owner then asked for a README a visitor can read, with a short
feature list and the milestone record left to ROADMAP and CHANGELOG (TODO, 2026-10-20),
so the README now has to point at those two instead, and must still never describe
unshipped work as built, name a stale release, or let Latest grow.

The same shape as :mod:`tests.test_module_boundaries` — parse the artifact rather than
trust it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROADMAP = ROOT / "docs" / "ROADMAP.md"
README = ROOT / "README.md"

# `| 16 | ✅ done | **Three-dimensional map** — ... |`
_ROADMAP_DONE = re.compile(r"^\|\s*(\d+)\s*\|\s*✅\s*done\b", re.MULTILINE)

# `(M16, built)`, and ranges written with a hyphen, en dash or em dash: `(M2–M6, built)`.
_FEATURE_TAG = re.compile(r"\(M(\d+)(?:\s*[–—-]\s*M?(\d+))?\s*,\s*built\)")


def _roadmap_shipped() -> set[int]:
    """Milestone numbers the roadmap marks as done."""
    return {int(m.group(1)) for m in _ROADMAP_DONE.finditer(ROADMAP.read_text())}


def _features_section() -> str:
    """The README's Features list, from its heading to the next one."""
    text = README.read_text()
    start = text.index("\n## Features\n")
    end = text.index("\n## ", start + 1)
    return text[start:end]


def _features_described() -> set[int]:
    """Milestone numbers the Features list claims to describe, ranges expanded."""
    described: set[int] = set()
    for first, last in _FEATURE_TAG.findall(_features_section()):
        lo = int(first)
        hi = int(last) if last else lo
        described.update(range(min(lo, hi), max(lo, hi) + 1))
    return described


def test_the_readme_points_to_where_shipped_work_is_recorded() -> None:
    """The milestone-by-milestone record lives in ROADMAP and CHANGELOG, so the README
    has to send a reader there, near the top and again from its status block."""
    assert _roadmap_shipped(), (
        "parsed no shipped milestones from ROADMAP.md — the table format moved"
    )
    text = README.read_text()
    status = text[: text.index("\n## ")]
    for document in ("docs/ROADMAP.md", "CHANGELOG.md"):
        assert f"]({document})" in status, (
            f"README.md's opening and status block do not link {document}, where "
            "shipped work is recorded now that the Features list is short."
        )


def test_the_features_list_does_not_claim_unshipped_milestones() -> None:
    """The inverse: a feature described before it ships is aspirational documentation."""
    shipped = _roadmap_shipped()
    described = _features_described()

    unshipped = sorted(described - shipped)
    assert not unshipped, (
        "README.md's Features list describes these as built, but ROADMAP.md does not "
        f"mark them done: {', '.join(f'M{n}' for n in unshipped)}. Either the roadmap "
        "row is stale or the README is describing work that has not shipped."
    )


# The README's status block: `> **Latest.** ...` up to the next `> **` paragraph.
_LATEST = re.compile(
    r"^> \*\*Latest\.\*\*(.*?)(?=^>\s*\n> \*\*|\Z)", re.MULTILINE | re.DOTALL
)
# The status line's version is filled by `hip readme` (tests/test_readme.py, #420).
_LATEST_WORDS = 60


def test_the_readme_latest_is_only_the_newest_milestone_and_short() -> None:
    """Latest grew to eight milestones in one paragraph; older ones belong in
    CHANGELOG.md, not the top of the README. Work between milestones names none."""
    latest = _LATEST.search(README.read_text())
    assert latest, "README.md's status block has no `**Latest.**` paragraph."
    text = latest.group(1).replace(">", " ")
    words = len(text.split())
    assert words <= _LATEST_WORDS, (
        f"README.md's Latest is {words} words; keep it to {_LATEST_WORDS} — the newest "
        "milestone only."
    )
    named = {int(n) for n in re.findall(r"Milestone (\d+)", text)}
    assert named <= {max(_roadmap_shipped())}, (
        f"README.md's Latest names milestones {sorted(named)}; it may name only the "
        f"newest shipped one, M{max(_roadmap_shipped())}."
    )
