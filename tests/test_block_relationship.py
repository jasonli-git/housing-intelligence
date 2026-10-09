"""The Census's 2010-to-2020 block relationship, read for placing flood claims (#354)."""

import zipfile
from pathlib import Path

import pytest

from hip.sources.base import ReleaseRef, SourceError
from hip.sources.census_blocks import BlockRelationshipAdapter

HEADER = (
    "STATE_2010|COUNTY_2010|TRACT_2010|BLK_2010|BLKSF_2010|AREALAND_2010|AREAWATER_2010|"
    "BLOCK_PART_FLAG_O|STATE_2020|COUNTY_2020|TRACT_2020|BLK_2020|BLKSF_2020|"
    "AREALAND_2020|AREAWATER_2020|BLOCK_PART_FLAG_R|AREALAND_INT|AREAWATER_INT"
)


def _zip(tmp_path: Path, lines: list[str], header: str = HEADER) -> Path:
    path = tmp_path / "TAB2010_TAB2020_ST34.zip"
    with zipfile.ZipFile(path, "w") as archive:
        # The Census's file opens with a byte-order mark.
        archive.writestr("tab2010_tab2020_st34_nj.txt", "﻿" + "\n".join([header, *lines]))
    return path


def _ref() -> ReleaseRef:
    return BlockRelationshipAdapter(states=["NJ"]).refs()[0]


def test_the_ref_names_the_states_file() -> None:
    assert _ref().url.endswith("/t10t20/TAB2010_TAB2020_ST34.zip")


def test_only_land_shared_within_the_state_is_kept(tmp_path: Path) -> None:
    path = _zip(
        tmp_path,
        [
            "34|001|000100|1000||941|156179|p|34|001|000100|1001||5000|0||900|0",
            # Water only: places no homes.
            "34|001|000100|1000||941|156179|p|34|001|000100|1002||0|156179||0|156179",
            # A neighbour's pair, listed along the border.
            "10|003|990100|0015||4250|6273626|p|10|003|021600|1000||43000|0|p|4250|0",
        ],
    )
    [record] = BlockRelationshipAdapter.xlsx_records(path, _ref())
    assert record == {
        "block_2010": "340010001001000",
        "block_2020": "340010001001001",
        "land_2020": 5000.0,
        "land_shared": 900.0,
    }


def test_changed_columns_or_nothing_kept_fail(tmp_path: Path) -> None:
    with pytest.raises(SourceError, match="columns changed"):
        BlockRelationshipAdapter.xlsx_records(
            _zip(tmp_path, [], header=HEADER.replace("AREALAND_INT", "AREA_INT")), _ref()
        )
    with pytest.raises(SourceError, match="no block pairs"):
        BlockRelationshipAdapter.xlsx_records(_zip(tmp_path, []), _ref())
