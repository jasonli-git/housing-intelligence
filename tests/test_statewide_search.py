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
from hip.config import Settings, get_settings
from hip.removals import Filter, Removal, RemovalListUnavailable, read, write

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
    assert shard("COMMUNITY DR") == "CO"
    assert shard("1ST AVE") == "1S"


def _removal(**changes: str | None) -> Removal:
    base: dict[str, str | None] = {
        "geoid": "3403547580",
        "block": "20001",
        "lot": "10.05",
        "qualifier": None,
        "number": "100",
        "street": "COMMUNITY DR",
        "received": "2026-10-02",
    }
    return Removal(**{**base, **changes})  # type: ignore[arg-type]


def test_a_withdrawal_matches_by_lot_or_by_address() -> None:
    withdrawn = Filter([_removal()])
    town = "3403547580"
    assert withdrawn.withdrawn(town, "20001", "10.05", None, "100 COMMUNITY DRIVE")
    # Renumbered lot, same address: still withdrawn.
    assert withdrawn.withdrawn("3403547580", "99", "1", None, "100 Community Dr.")
    # Same lot, address respelled: still withdrawn.
    assert withdrawn.withdrawn("3403547580", "20001", "10.05", None, None)
    # The same address in another town is not.
    other = "3402160900"
    assert not withdrawn.withdrawn(other, "20001", "10.05", None, "100 COMMUNITY DR")
    assert not withdrawn.withdrawn("3403547580", "11001", "56", None, "150 HOLLOW ROAD")
    assert withdrawn.unmatched() == []


def test_a_withdrawal_that_matches_nothing_is_reported() -> None:
    withdrawn = Filter([_removal()])
    withdrawn.withdrawn("3403547580", "1", "1", None, "1 ELM ST")
    assert withdrawn.unmatched() == [_removal()]


def test_the_removal_list_round_trips_and_starts_empty(tmp_path: Path) -> None:
    path = tmp_path / "address-removals.json"
    assert read(path) == []
    write(path, [_removal()])
    assert read(path) == [_removal()]


def test_the_removal_list_lives_in_icloud_outside_the_repository() -> None:
    """Synced and backed up, and never committable: a public list of protected
    addresses would be the disclosure the law forbids (#296)."""
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.removals_file == settings.gate_dir / "address-removals.json"
    assert "CloudDocs" in str(settings.removals_file)
    repo = Path(__file__).resolve().parents[1]
    assert not settings.removals_file.is_relative_to(repo)


def test_a_missing_folder_stops_a_publish_rather_than_emptying_the_list(
    tmp_path: Path,
) -> None:
    """An empty list would put every withdrawn address back on the site."""
    absent = tmp_path / "not-synced" / "address-removals.json"
    with pytest.raises(RemovalListUnavailable, match="not on this machine"):
        read(absent)
    with pytest.raises(RemovalListUnavailable):
        write(absent, [_removal()])


def test_a_list_still_in_icloud_is_not_read_as_empty(tmp_path: Path) -> None:
    path = tmp_path / "address-removals.json"
    (tmp_path / ".address-removals.json.icloud").write_text("")
    with pytest.raises(RemovalListUnavailable, match="not downloaded"):
        read(path)


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


def test_a_mailed_town_is_not_the_municipality(tmp_path: Path) -> None:
    """Montgomery's township building: "Skillman 08558" by mail, Montgomery by assessor —
    the failure the owner hit with an address mailed to Princeton."""
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
    index = json.loads((streets / f"{shard('COMMUNITY DR')}.json").read_text())
    assert "100" in index["COMMUNITY DR"]["3403547580"]
    meta = json.loads((streets / "meta.json").read_text())
    assert meta["towns"]["3403547580"] == ["Montgomery", "Somerset", "1813"]
    assert "3403547580" in meta["zips"]["08558"]
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
    assert "100 COMMUNITY DR" not in addresses
    assert "150 HOLLOW ROAD" in addresses
    streets = tmp_path / "parcels" / "streets"
    community = json.loads((streets / "CO.json").read_text())
    assert "100" not in community.get("COMMUNITY DR", {}).get("3403547580", [])
    # "Hollow" is itself a USPS suffix, so the index holds it as "HOLW RD".
    kept = parse("150 HOLLOW ROAD")
    hollow = json.loads((streets / f"{shard(kept.street)}.json").read_text())
    assert "150" in hollow[kept.street]["3403547580"]
