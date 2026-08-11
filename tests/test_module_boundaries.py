"""Enforce the module dependency rule from ARCHITECTURE.md.

    sources → landing → transform → geography → validate → warehouse → analytics → packets
                                                              ↑
                                                            api (reads only)

Imports flow one direction along the pipeline and never back. ``api`` may import only
``warehouse`` and ``packets``; nothing imports ``api``; ``hip.config`` is importable
from anywhere.

This is decision #6 made structural: if the API cannot import ``sources`` or
``transform``, it cannot trigger a pipeline stage no matter what a handler tries to do.
"""

from __future__ import annotations

import ast
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "hip"

PIPELINE = [
    "sources",
    "landing",
    "transform",
    "geography",
    "validate",
    "warehouse",
    "analytics",
    "packets",
]
STAGE_INDEX = {name: i for i, name in enumerate(PIPELINE)}

# What `api` is allowed to reach into. Deliberately short.
API_MAY_IMPORT = {"warehouse", "packets"}

# Not pipeline stages: importable from anywhere.
ALWAYS_ALLOWED = {"config", None}


def _subpackage(module: str) -> str | None:
    """'hip.warehouse.db' -> 'warehouse'; 'hip.config' -> 'config'; 'hip' -> None."""
    parts = module.split(".")
    return parts[1] if len(parts) > 1 else None


def _hip_imports(path: Path) -> set[str]:
    """Absolute `hip.*` module names imported by a file, including relative imports."""
    tree = ast.parse(path.read_text(), filename=str(path))
    # Package this file lives in, e.g. 'hip.api.routers' for hip/api/routers/health.py
    rel_parts = path.relative_to(SRC).parts
    package = ".".join(["hip", *rel_parts[:-1]])

    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "hip" or alias.name.startswith("hip."):
                    found.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.level:  # relative: resolve against this file's package
                base = package.split(".")
                trimmed = base[: len(base) - node.level + 1]
                found.add(".".join([*trimmed, node.module] if node.module else trimmed))
            elif node.module and (node.module == "hip" or node.module.startswith("hip.")):
                found.add(node.module)
    return found


def violations(owner: str | None, imports: set[str]) -> list[str]:
    """Pure rule check. ``owner`` is the importing file's subpackage (None = hip/*.py)."""
    problems: list[str] = []
    for imported in sorted(imports):
        target = _subpackage(imported)
        if target in ALWAYS_ALLOWED or target == owner:
            continue

        if target == "api":
            problems.append(
                f"{owner or 'hip'} imports {imported}: nothing may import api"
            )
            continue

        if owner == "api":
            if target not in API_MAY_IMPORT:
                problems.append(
                    f"api imports {imported}: api may import only "
                    f"{', '.join(sorted(API_MAY_IMPORT))}"
                )
            continue

        # hip/*.py top-level files (cli.py) orchestrate every stage — allowed.
        if owner is None:
            continue

        if (
            owner in STAGE_INDEX
            and target in STAGE_INDEX
            and STAGE_INDEX[target] > STAGE_INDEX[owner]
        ):
            problems.append(
                f"{owner} imports {imported}: {target} is later in the pipeline "
                f"({owner} → ... → {target}); imports never flow backward"
            )
    return problems


def test_source_tree_respects_the_dependency_rule() -> None:
    problems: list[str] = []
    for path in sorted(SRC.rglob("*.py")):
        if "migrations" in path.parts:  # Alembic env/versions are not app modules
            continue
        rel = path.relative_to(SRC).parts
        owner = rel[0] if len(rel) > 1 else None
        problems.extend(
            f"{path.relative_to(SRC.parent.parent)}: {p}"
            for p in violations(owner, _hip_imports(path))
        )
    assert not problems, "module boundary violations:\n  " + "\n  ".join(problems)


def test_checker_catches_known_violations() -> None:
    """The checker must fail on real violations, or the test above is decorative."""
    assert violations("api", {"hip.sources.zillow"})
    assert violations("api", {"hip.transform"})
    assert violations("warehouse", {"hip.analytics"})  # backward: warehouse ← analytics
    assert violations("sources", {"hip.packets"})
    assert violations("analytics", {"hip.api.main"})

    # And must not fire on legitimate imports.
    assert not violations("api", {"hip.warehouse.db", "hip.packets"})
    assert not violations("analytics", {"hip.warehouse.db"})  # forward is fine
    assert not violations("sources", {"hip.config"})
    assert not violations(None, {"hip.sources", "hip.analytics"})  # cli.py orchestrates


def test_every_pipeline_stage_exists_as_a_package() -> None:
    """The rule is meaningless if a stage silently disappears."""
    missing = [s for s in PIPELINE if not (SRC / s / "__init__.py").exists()]
    assert not missing, f"missing pipeline packages: {missing}"
