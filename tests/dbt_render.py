"""What a staging model needs from dbt to be rendered in a test (Milestone 63).

New Jersey and Pennsylvania are the scope: `var("state_fips")` and the `scoped_layer`
macro (`dbt/macros/scoped_layer.sql`) answer for both, as dbt would.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

STATE_FIPS = "'34', '42'"


def scoped_layer(base: str, fips: str) -> str:
    return f"case {fips} when '34' then '{base}' when '42' then '{base}_pa' end"


def dbt_context(var: Callable[[str], Any]) -> dict[str, Any]:
    """`config`, `ref`, `scoped_layer` and a `var` that answers `state_fips` itself."""
    return {
        "config": lambda **_: "",
        "ref": lambda name: name,
        "scoped_layer": scoped_layer,
        "var": lambda name: STATE_FIPS if name == "state_fips" else var(name),
    }
