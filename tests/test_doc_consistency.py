"""Hold `README.md` to what `ROADMAP.md` says has shipped.

A milestone marked ``✅ done`` in the roadmap has to be described somewhere in the
README's Features list. Nothing else here checks that, and nothing noticed when it
stopped being true: on 2026-09-19 the list named M0–M9, M13, M17, M21 and M23 while
M11, M12, M16, M18, M19 and M20 had all shipped — including M16's globe, the most
recent milestone and the platform's main visual object.

This cannot write the prose. What a milestone *means* to a reader is editorial, and a
generated sentence about a feature nobody checked is worse than no sentence. What it
can do is refuse to let a shipped milestone go undescribed, which is the half that was
actually failing.

The same shape as :mod:`tests.test_module_boundaries` — parse the artifact rather than
trust it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROADMAP = ROOT / "ROADMAP.md"
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


def test_every_shipped_milestone_is_described_in_the_readme_features_list() -> None:
    shipped = _roadmap_shipped()
    described = _features_described()
    assert shipped, (
        "parsed no shipped milestones from ROADMAP.md — the table format moved"
    )

    missing = sorted(shipped - described)
    assert not missing, (
        "ROADMAP.md marks these milestones done but README.md's Features list does not "
        f"describe them: {', '.join(f'M{n}' for n in missing)}. Add a bullet tagged "
        "`(M<n>, built)` saying what the milestone gives a reader — write it, do not "
        "generate it."
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
