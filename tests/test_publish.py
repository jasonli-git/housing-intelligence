"""Static publication: path layout, byte-identity with the API, manifest integrity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hip.api.main import app
from hip.publish import (
    PUBLISHED_WINDOWS,
    UNPUBLISHABLE,
    RegionIdentityChanged,
    _check_region_identity,
    _plan,
    publish,
)
from hip.warehouse.db import probe

client = TestClient(app)


# --- Path layout. Pure: no warehouse, no HTTP. ------------------------------------


def _only_ranking(keys: list[tuple[str, str, str, str]]) -> tuple[str, str]:
    """The one ranking pair in a plan, past the fixed entries the plan always yields."""
    pairs = [pair for pair in _plan([], keys) if pair[1].startswith("rankings/")]
    assert len(pairs) == 1, pairs
    return pairs[0]


def test_plan_maps_query_windows_onto_path_segments() -> None:
    """A static file cannot vary on `?window=`, so the window becomes a segment."""
    plan = dict(_plan([11], []))
    assert plan["/regions/11/summary?window=5y"] == "regions/11/summary/5y.json"
    assert plan["/regions/11/packet?window=5y"] == "regions/11/packet/5y.json"
    assert plan["/regions/11/report?window=5y"] == "regions/11/report/5y.md"


def test_plan_publishes_reports_as_markdown_not_json() -> None:
    """`/regions/{id}/report` serves text/markdown; the extension has to follow."""
    paths = [out for _, out in _plan([11], [])]
    assert "regions/11/report/5y.md" in paths
    assert "regions/11/report/5y.json" not in paths


def test_value_rankings_omit_the_window_from_the_request_but_keep_it_in_the_path() -> (
    None
):
    """`latest` is storage vocabulary, not API vocabulary.

    `region_rankings` stores a value ranking under the sentinel window `latest`, but the
    endpoint's `Window` literal has no such member and `basis=value` ignores the
    parameter entirely. Sending it back produced a 422 and was caught by the publish
    gate rather than by a reader.
    """
    keys = [("modiv_median_assessed_value", "municipality", "latest", "value")]
    api_path, out_path = _only_ranking(keys)
    assert "window=" not in api_path
    assert out_path == (
        "rankings/modiv_median_assessed_value/municipality/latest/value.json"
    )


def test_change_rankings_do_send_the_window() -> None:
    keys = [("zhvi_sfr", "county", "5y", "change")]
    api_path, out_path = _only_ranking(keys)
    assert "window=5y" in api_path
    assert out_path == "rankings/zhvi_sfr/county/5y/change.json"


def test_plan_paths_are_unique() -> None:
    """Two API paths writing one file would silently drop an artifact."""
    paths = [out for _, out in _plan([11, 12], [("zhvi_sfr", "county", "5y", "change")])]
    assert len(paths) == len(set(paths))


def test_plan_covers_every_published_window() -> None:
    paths = [out for _, out in _plan([11], [])]
    for window in PUBLISHED_WINDOWS:
        assert f"regions/11/summary/{window}.json" in paths


def test_unpublishable_endpoints_are_named() -> None:
    """The gap is documented rather than silent, and travels in the manifest."""
    assert "/compare" in UNPUBLISHABLE
    assert all(reason for reason in UNPUBLISHABLE.values())


# --- Against a real warehouse. -----------------------------------------------------

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture(scope="module")
def published(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("publish")
    publish(root)
    return root


@warehouse
def test_published_artifact_is_byte_identical_to_the_live_response(
    published: Path,
) -> None:
    """The claim that justifies importing `hip.api` at all (#67).

    If these ever differ, the static tree is a second implementation of the API rather
    than a recording of it, and every other guarantee here is worth less.
    """
    manifest = json.loads((published / "manifest.json").read_text())
    # A spread across response kinds: JSON model, GeoJSON, markdown, ranking.
    wanted = ("health.json", "geo/county.json")
    checked = 0
    for entry in manifest["artifacts"]:
        if not (entry["path"] in wanted or entry["path"].endswith(("report/5y.md",))):
            continue
        live = client.get(entry["source"])
        assert live.status_code == 200, entry["source"]
        assert (published / entry["path"]).read_bytes() == live.content, entry["path"]
        checked += 1
        if checked >= 8:
            break
    assert checked, "no artifacts compared"


@warehouse
def test_manifest_hashes_match_the_files_on_disk(published: Path) -> None:
    manifest = json.loads((published / "manifest.json").read_text())
    assert manifest["artifact_count"] == len(manifest["artifacts"])
    for entry in manifest["artifacts"][:200]:
        blob = (published / entry["path"]).read_bytes()
        assert hashlib.sha256(blob).hexdigest() == entry["sha256"], entry["path"]
        assert len(blob) == entry["bytes"]


@warehouse
def test_every_manifest_entry_exists_on_disk(published: Path) -> None:
    manifest = json.loads((published / "manifest.json").read_text())
    missing = [
        e["path"] for e in manifest["artifacts"] if not (published / e["path"]).exists()
    ]
    assert not missing


@warehouse
def test_skipped_entries_are_explanations_not_data(published: Path) -> None:
    """404s are expected only where `hip explain` has not run, never for a packet."""
    manifest = json.loads((published / "manifest.json").read_text())
    unexpected = [path for path in manifest["skipped_404"] if "/explanation" not in path]
    assert not unexpected, f"unexpected 404s: {unexpected[:5]}"


# --- Region identity. Pure: a manifest on disk, no warehouse. ----------------------


def _manifest(tmp_path: Path, regions: dict[str, str]) -> Path:
    (tmp_path / "manifest.json").write_text(json.dumps({"regions": regions}))
    return tmp_path


def test_first_publish_has_nothing_to_compare(tmp_path: Path) -> None:
    _check_region_identity(tmp_path, {"8": "34003"})  # no manifest yet


def test_unchanged_ids_pass(tmp_path: Path) -> None:
    _check_region_identity(_manifest(tmp_path, {"8": "34003"}), {"8": "34003"})


def test_a_reassigned_id_is_refused(tmp_path: Path) -> None:
    """The failure this exists to prevent: a URL that still resolves, to the wrong place.

    Bergen is region 8 / GEOID 34003. If a rebuild-from-empty makes region 8 into Mercer,
    every published Bergen URL silently becomes a Mercer URL.
    """
    root = _manifest(tmp_path, {"8": "34003", "11": "34021"})
    with pytest.raises(RegionIdentityChanged) as caught:
        _check_region_identity(root, {"8": "34021", "11": "34003"})
    assert "region 8: 34003 -> 34021" in str(caught.value)


def test_new_ids_are_not_a_change(tmp_path: Path) -> None:
    """Expansion adds regions; that is growth, not reassignment."""
    root = _manifest(tmp_path, {"8": "34003"})
    _check_region_identity(root, {"8": "34003", "9000": "36061"})


def test_an_unreadable_manifest_is_not_evidence(tmp_path: Path) -> None:
    (tmp_path / "manifest.json").write_text("{ not json")
    _check_region_identity(tmp_path, {"8": "34003"})
