"""The README's figures, filled from the files that hold them (ARCHITECTURE #417, #420).

A figure the README states is wrapped in a marker,
`<!-- fill:sources -->52<!-- /fill -->`, which GitHub does not render. `hip readme`
rewrites what sits between each pair from its source; `hip readme --check` and
`tests/test_readme.py` fail when one differs. Every source is a file in the repository,
so the check needs no warehouse:

- sources: the registry entries NOTICE lists (`hip.notice`'s rule);
- counties, towns, ZIP codes: the pinned place pages in `web/lib/placeRoutes.json`;
- the version: CHANGELOG's newest released heading;
- the Tech Stack's versions: `.python-version`, `web/package.json`, `docker-compose.yml`;
- the newest readings comparison: `reports/evaluation/readings-v*.md`.

The writing is not generated. Two checks keep it from falling behind instead: every
evaluation report is linked, and the status line's "updated" date is no older than the
last commit to touch CHANGELOG.md.
"""

from __future__ import annotations

import json
import re
import subprocess
from collections import Counter
from collections.abc import Callable
from datetime import date
from pathlib import Path

MARKER = re.compile(r"<!-- fill:(?P<name>[a-z_]+) -->(?P<value>.*?)<!-- /fill -->")
# The date may wrap onto the blockquote's next line.
UPDATED = re.compile(r"updated\s+(?:>\s*)?(\d{4}-\d{2}-\d{2})")
RELEASE = re.compile(
    r"^## \[(?P<version>\d+\.\d+\.\d+)\] — (?P<date>\d{4}-\d{2}-\d{2})", re.M
)


def _sources(root: Path) -> str:
    from hip.config import load_sources
    from hip.notice import _NOT_LISTED
    from hip.sources.registry import PLANNED

    return str(sum(1 for sid in load_sources() if sid not in _NOT_LISTED | set(PLANNED)))


def _places(root: Path) -> Counter[str]:
    routes = json.loads((root / "web/lib/placeRoutes.json").read_text())
    return Counter(r["level"] for r in routes.values() if r["state"] == "nj")


def _version(root: Path) -> str:
    match = RELEASE.search((root / "CHANGELOG.md").read_text())
    if match is None:
        raise ValueError("CHANGELOG.md has no released version heading")
    return f"v{match['version']} ({match['date']})"


def _major(spec: str) -> str:
    return re.sub(r"^[^\d]*", "", spec).split(".")[0]


def _package(root: Path, name: str) -> str:
    package = json.loads((root / "web/package.json").read_text())
    return _major(package["dependencies"][name])


def _postgres(root: Path) -> str:
    compose = (root / "docker-compose.yml").read_text()
    match = re.search(r"image: postgis/postgis:(\d+)-", compose)
    if match is None:
        raise ValueError("docker-compose.yml names no postgis/postgis image")
    return match.group(1)


def _readings(root: Path) -> str:
    found = [
        int(p.stem.removeprefix("readings-v"))
        for p in (root / "reports/evaluation").glob("readings-v*.md")
        if p.stem.removeprefix("readings-v").isdigit()
    ]
    return f"v{max(found)}"


FIELDS: dict[str, Callable[[Path], str]] = {
    "sources": _sources,
    "counties": lambda root: str(_places(root)["county"]),
    "towns": lambda root: str(_places(root)["municipality"]),
    "zips": lambda root: str(_places(root)["zip"]),
    "version": _version,
    "python": lambda root: (root / ".python-version").read_text().strip(),
    "nextjs": lambda root: _package(root, "next"),
    "react": lambda root: _package(root, "react"),
    "postgres": _postgres,
    "readings": _readings,
}


def fill(text: str, root: Path) -> str:
    """The README with every marker's value rewritten from its source."""
    names = {m["name"] for m in MARKER.finditer(text)}
    unknown = names - FIELDS.keys()
    if unknown:
        raise ValueError(f"README marks figures nothing fills: {sorted(unknown)}")
    values = {name: FIELDS[name](root) for name in names}
    return MARKER.sub(
        lambda m: f"<!-- fill:{m['name']} -->{values[m['name']]}<!-- /fill -->", text
    )


def writing_problems(text: str, root: Path) -> list[str]:
    """What the hand-written parts have let fall behind."""
    problems = []
    for report in sorted((root / "reports/evaluation").glob("v*.md")):
        if f"reports/evaluation/{report.name}" not in text:
            problems.append(f"{report.name} is not linked under Model evaluation")
    updated = UPDATED.search(text)
    changed = _last_changed(root, "CHANGELOG.md")
    if updated is None:
        problems.append('the status line has no "updated YYYY-MM-DD" date')
    elif changed is not None and date.fromisoformat(updated.group(1)) < changed:
        problems.append(
            f"the status line says updated {updated.group(1)}, but CHANGELOG.md changed "
            f'on {changed}: rewrite "Latest" and the date'
        )
    return problems


def _last_changed(root: Path, path: str) -> date | None:
    """The committer date of the last commit to touch `path`; None outside git."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", path],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    return date.fromisoformat(out) if out else None
