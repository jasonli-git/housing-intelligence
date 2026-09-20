"""The NJ CD code to Census GEOID crosswalk, and the ten aliases that complete it.

`stg_nj_municipal_codes` resolves 554 of New Jersey's 564 municipalities by matching
MOD-IV's `MUN_NAME` against Census names. The remaining ten are spelled in ways no
normalisation rule reaches — `MUN_NAME` is fixed-width and truncates, and one place is
written in a different word order — so they are listed explicitly instead.

A hand-written list is only safe while something checks it. These tests re-derive each
alias's three properties from TIGER rather than trusting the list, so a mistyped GEOID
attributes no town's figures to another.
"""

from __future__ import annotations

import duckdb
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.config import get_settings
from hip.warehouse.db import get_engine, probe

# New Jersey's municipality count, fixed since the Princeton merger of 2013.
NJ_MUNICIPALITIES = 564

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


def _crosswalk() -> dict[str, str]:
    with Session(get_engine()) as session:
        return {
            row[0]: row[1]
            for row in session.execute(
                text(
                    "SELECT i.identifier, r.geoid FROM region_identifiers i "
                    "JOIN regions r ON r.region_id = i.region_id "
                    "WHERE i.scheme = 'nj_cd_code'"
                )
            ).all()
        }


def _tiger() -> dict[str, tuple[str, str]]:
    """GEOID -> (county FIPS, name), straight from the TIGER release on disk."""
    pattern = f"{get_settings().parquet_dir}/census_tiger/*/cousub_NJ.parquet"
    with duckdb.connect() as con:
        return {
            row[0]: (row[1], row[2])
            for row in con.execute(
                "SELECT GEOID, COUNTYFP, NAMELSAD FROM read_parquet(?) "
                "WHERE COUSUBFP <> '00000'",
                [pattern],
            ).fetchall()
        }


@warehouse
def test_every_municipality_has_a_cd_code_and_no_code_is_used_twice() -> None:
    crosswalk = _crosswalk()
    assert len(crosswalk) == NJ_MUNICIPALITIES
    assert len(set(crosswalk.values())) == NJ_MUNICIPALITIES, "a GEOID is claimed twice"


@warehouse
def test_no_cd_code_is_mapped_outside_the_county_its_own_prefix_names() -> None:
    """The check an alias cannot fake.

    The first two digits of a CD code are NJ's own county number, and NJ county FIPS run
    odd and alphabetical — so the county is known by arithmetic, with no reference to
    any name. An alias pointing at the right-sounding town in the wrong county fails
    here even though both halves look correct in isolation.
    """
    tiger = _tiger()
    wrong = {
        cd: (geoid, tiger.get(geoid))
        for cd, geoid in _crosswalk().items()
        if geoid not in tiger or tiger[geoid][0] != f"{2 * int(cd[:2]) - 1:03d}"
    }
    assert not wrong, f"CD codes mapped outside their own county: {wrong}"


@warehouse
def test_the_crosswalk_covers_every_cd_code_modiv_publishes() -> None:
    """Coverage is the point of the aliases; without them ten codes resolve to nothing."""
    pattern = f"{get_settings().parquet_dir}/nj_modiv/*/statewide.parquet"
    with duckdb.connect() as con:
        published = {
            row[0]
            for row in con.execute(
                "SELECT DISTINCT CD_CODE FROM read_parquet(?) "
                "WHERE CD_CODE IS NOT NULL AND CD_CODE <> ''",
                [pattern],
            ).fetchall()
        }
    assert not (published - set(_crosswalk())), "MOD-IV publishes a code with no GEOID"
