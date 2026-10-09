"""The Daniel's Law removal list cannot shrink unnoticed, and a rollback cannot undo a
removal (ARCHITECTURE #359)."""

import json
from pathlib import Path

import pytest

from hip.removals import (
    LEDGER_KEEP,
    Removal,
    RemovalListShrank,
    check_not_shrunk,
    fingerprint,
    honoured_by,
    ledger_path,
    record,
    write,
)
from hip.rollback import RollbackRefused, added_keys, check_removals


def _removal(lot: str) -> Removal:
    return Removal(
        geoid="3402973125",
        block="10",
        lot=lot,
        qualifier=None,
        number="12",
        street="ELM CT",
        received="2026-10-09",
    )


@pytest.fixture
def listed(tmp_path: Path) -> Path:
    return tmp_path / "address-removals.json"


def test_the_ledger_holds_hashes_never_addresses(listed: Path) -> None:
    record(listed, [_removal("1")], "2026-10-09T00:00:00+00:00")
    text = ledger_path(listed).read_text()
    assert "ELM" not in text and "3402973125" not in text
    assert json.loads(text)[0]["count"] == 1


def test_a_list_that_lost_an_entry_refuses_to_publish(listed: Path) -> None:
    record(listed, [_removal("1"), _removal("2")], "2026-10-09T00:00:00+00:00")
    with pytest.raises(RemovalListShrank, match="1 entry"):
        check_not_shrunk(listed, [_removal("1"), _removal("3")])
    # A deleted list reads as none at all, which is every entry gone.
    with pytest.raises(RemovalListShrank, match="2 entries"):
        check_not_shrunk(listed, [])


def test_growing_the_list_or_a_first_publish_is_fine(listed: Path) -> None:
    check_not_shrunk(listed, [])
    record(listed, [_removal("1")], "2026-10-09T00:00:00+00:00")
    check_not_shrunk(listed, [_removal("1"), _removal("2")])


def test_lifting_a_removal_on_purpose_is_allowed_by_name(
    listed: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record(listed, [_removal("1")], "2026-10-09T00:00:00+00:00")
    monkeypatch.setenv("HIP_ALLOW_REMOVAL_SHRINK", "1")
    check_not_shrunk(listed, [])


def test_the_ledger_keeps_recent_builds_only(listed: Path) -> None:
    for i in range(LEDGER_KEEP + 5):
        record(listed, [], f"build-{i}")
    assert honoured_by(listed, "build-0") is None
    assert honoured_by(listed, f"build-{LEDGER_KEEP + 4}") == fingerprint([])


def test_a_rollback_never_restores_a_build_from_before_a_removal(listed: Path) -> None:
    before = "2026-10-08T00:00:00+00:00"
    record(listed, [], before)
    write(listed, [_removal("1")])  # a notice honoured since that build
    with pytest.raises(RollbackRefused, match="has changed"):
        check_removals(listed, before)
    with pytest.raises(RollbackRefused, match="no record"):
        check_removals(listed, "a build the ledger never saw")


def test_a_rollback_with_an_unchanged_list_may_proceed(listed: Path) -> None:
    write(listed, [_removal("1")])
    record(listed, [_removal("1")], "2026-10-08T00:00:00+00:00")
    check_removals(listed, "2026-10-08T00:00:00+00:00")


def test_a_rollback_deletes_only_what_the_last_deploy_added() -> None:
    before = {"manifest.json", "regions/5/packet/5y.json"}
    live = before | {"regions/9/packet/5y.json"}
    assert added_keys(before, live) == ["regions/9/packet/5y.json"]
