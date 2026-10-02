"""Find any property in New Jersey (Milestone 38).

Addresses normalised one way on both sides, the street index that finds the town, and
Daniel's Law withdrawals, which must leave a parcel out of both the town's file and the
index. Pure where it can be; the export checks skip without a warehouse.
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pytest

from hip.addresses import Address, parse, shard, street_words
from hip.config import get_settings
from hip.removals import Filter, Removal, read, write

FIXTURE = Path(__file__).parent / "fixtures" / "address_cases.json"
CASES = json.loads(FIXTURE.read_text())


@pytest.mark.parametrize(("typed", "assessor"), CASES["same"])
def test_a_typed_address_meets_the_assessors(typed: str, assessor: str) -> None:
    assert parse(typed) == parse(assessor)


@pytest.mark.parametrize(("address", "number", "street"), CASES["parsed"])
def test_an_address_parses_to_a_number_and_a_street(
    address: str, number: str | None, street: str
) -> None:
    assert parse(address) == Address(number=number, street=street)


def test_every_spelling_has_one_meaning() -> None:
    """A spelling under two abbreviations would make normalising depend on order."""
    seen: dict[str, str] = {}
    for standard, variants in street_words().items():
        assert standard in variants, standard
        for variant in variants:
            assert variant not in seen, (variant, seen.get(variant), standard)
            seen[variant] = standard


def test_a_street_lives_in_the_file_of_its_first_two_characters() -> None:
    assert shard("DANBY CT") == "DA"
    assert shard("1ST AVE") == "1S"


def _removal(**changes: str | None) -> Removal:
    base: dict[str, str | None] = {
        "geoid": "3403547580",
        "block": "34018",
        "lot": "15",
        "qualifier": None,
        "number": "4",
        "street": "DANBY CT",
        "received": "2026-10-02",
    }
    return Removal(**{**base, **changes})  # type: ignore[arg-type]


def test_a_withdrawal_matches_by_lot_or_by_address() -> None:
    withdrawn = Filter([_removal()])
    assert withdrawn.withdrawn("3403547580", "34018", "15", None, "4 DANBY COURT")
    # Renumbered lot, same address: still withdrawn.
    assert withdrawn.withdrawn("3403547580", "99", "1", None, "4 Danby Ct.")
    # Same lot, address respelled: still withdrawn.
    assert withdrawn.withdrawn("3403547580", "34018", "15", None, None)
    # The same address in another town is not.
    assert not withdrawn.withdrawn("3402160900", "34018", "15", None, "4 DANBY CT")
    assert not withdrawn.withdrawn("3403547580", "34018", "14", None, "6 DANBY COURT")
    assert withdrawn.unmatched() == []


def test_a_withdrawal_that_matches_nothing_is_reported() -> None:
    withdrawn = Filter([_removal()])
    withdrawn.withdrawn("3403547580", "1", "1", None, "1 ELM ST")
    assert withdrawn.unmatched() == [_removal()]


def test_the_removal_list_round_trips_and_starts_empty(tmp_path: Path) -> None:
    path = tmp_path / "address-removals.local"
    assert read(path) == []
    write(path, [_removal()])
    assert read(path) == [_removal()]


def test_the_removal_list_is_never_committed() -> None:
    """A public list of protected addresses would be the disclosure the law forbids."""
    import subprocess

    name = get_settings().address_removals.name
    ignored = subprocess.run(
        ["git", "check-ignore", "-q", name], cwd=Path(__file__).parents[1], check=False
    )
    assert ignored.returncode == 0, f"{name} is not ignored by git"


def _warehouse_with_parcels() -> None:
    from hip.warehouse.db import probe

    if not probe().migrated:
        pytest.skip("needs a migrated warehouse")
    parquet = get_settings().parquet_dir / "nj_modiv"
    landed = duckdb.sql(
        f"DESCRIBE SELECT * FROM read_parquet('{parquet}/*/statewide.parquet')"
    ).fetchall()
    if "PROP_LOC" not in {row[0] for row in landed}:
        pytest.skip("MOD-IV landed before Milestone 37's fields")


def test_danby_court_is_found_in_montgomery(tmp_path: Path) -> None:
    """The address the owner tried: "Princeton 08540" by mail, Montgomery by assessor."""
    from hip.parcels import export
    from hip.warehouse.db import get_engine

    _warehouse_with_parcels()
    export(
        tmp_path,
        parquet_dir=get_settings().parquet_dir,
        engine=get_engine(),
        tax_year=2024,
        towns={"3403547580", "3402160900"},
    )
    streets = tmp_path / "parcels" / "streets"
    index = json.loads((streets / f"{shard('DANBY CT')}.json").read_text())
    assert "4" in index["DANBY CT"]["3403547580"]
    meta = json.loads((streets / "meta.json").read_text())
    assert meta["towns"]["3403547580"] == ["Montgomery", "Somerset", "1813"]
    assert "3403547580" in meta["zips"]["08540"]
    assert meta["words"]["CT"] == street_words()["CT"]


def test_a_withdrawn_parcel_leaves_both_the_town_file_and_the_index(
    tmp_path: Path,
) -> None:
    from hip.parcels import export
    from hip.warehouse.db import get_engine

    _warehouse_with_parcels()
    export(
        tmp_path,
        parquet_dir=get_settings().parquet_dir,
        engine=get_engine(),
        tax_year=2024,
        towns={"3403547580"},
        removals=[_removal()],
    )
    town = json.loads((tmp_path / "parcels" / "3403547580.json").read_text())
    addresses = {row[3] for row in town["parcels"]}
    assert "4 DANBY COURT" not in addresses
    assert "6 DANBY COURT" in addresses
    index = json.loads((tmp_path / "parcels" / "streets" / "DA.json").read_text())
    assert "4" not in index["DANBY CT"]["3403547580"]
    assert "6" in index["DANBY CT"]["3403547580"]
