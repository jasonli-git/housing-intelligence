"""The Data Explorer's catalog: what links to what, and what it refuses to expose."""

from __future__ import annotations

import inspect
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from hip.warehouse import catalog
from hip.warehouse.catalog import model_catalog


def _model(name: str, sql: str, deps: list[str] | None = None) -> dict[str, Any]:
    return {
        "resource_type": "model",
        "name": name,
        "description": "",
        "raw_code": sql,
        "depends_on": {"nodes": deps or []},
    }


def test_models_link_to_sources_metrics_and_tests(tmp_path: Path) -> None:
    compiled = tmp_path / "compiled" / "hip" / "models" / "staging"
    compiled.mkdir(parents=True)
    # The macro hides the path in the raw SQL; only the compiled file spells it out.
    (compiled / "stg_a.sql").write_text(
        "select 'rent' as metric from read_parquet('/x/parquet/fred/current/*.parquet')"
    )
    manifest = {
        "nodes": {
            "model.hip.stg_a": _model("stg_a", "{{ a_macro() }}"),
            "model.hip.stg_b": _model("stg_b", "select 1", ["model.hip.stg_a"]),
            "test.hip.t": {
                "resource_type": "test",
                "name": "t",
                "depends_on": {"nodes": ["model.hip.stg_a"]},
            },
        }
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    rows = model_catalog(
        tmp_path,
        tmp_path / "absent.duckdb",
        sources={"fred": SimpleNamespace()},  # type: ignore[dict-item]
        metrics={"rent": SimpleNamespace(), "other": SimpleNamespace()},  # type: ignore[dict-item]
    )
    first, second = rows
    assert first["sources"] == ["fred"]
    assert first["metrics"] == ["rent"]
    assert first["tests"] == 1
    assert second["upstream"] == ["stg_a"]


def test_a_missing_manifest_is_an_empty_list(tmp_path: Path) -> None:
    assert model_catalog(tmp_path, tmp_path / "x", sources={}, metrics={}) == []


def test_no_sample_values_are_ever_read() -> None:
    source = inspect.getsource(catalog)
    code = source.split('"""', 2)[2]
    assert "most_common_vals" not in code
    assert "histogram_bounds" not in code
