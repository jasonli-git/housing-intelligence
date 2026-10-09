"""HUD's bulk CHAS Table 8, read for the margins the API leaves out (#353)."""

import csv
import io
import zipfile
from pathlib import Path

import pytest

from hip.sources.base import ReleaseRef, SourceError
from hip.sources.hud import (
    CHAS_OWNER_BANDS,
    CHAS_RENTER_BANDS,
    CHAS_TABLE8_COLUMNS,
    HudChasBulkAdapter,
)


def _row(geoid: str, sumlevel: str = "050", **overrides: str) -> dict[str, str]:
    """A Table 8 row that adds up: 10 households in every burden cell."""
    est = dict.fromkeys(range(1, CHAS_TABLE8_COLUMNS + 1), 0.0)
    for bands, total in ((CHAS_OWNER_BANDS, 2), (CHAS_RENTER_BANDS, 68)):
        for band in bands:
            for step in (1, 4, 7, 10):
                est[band + step] = 10.0
            est[band] = 40.0
        est[total] = 200.0
    est[1] = 400.0
    row = {
        "source": "2018thru2022",
        "sumlevel": sumlevel,
        "geoid": geoid,
        "name": "Somewhere",
        "st": geoid.split("US")[1][:2],
        "cnty": "",
        **{f"T8_est{i}": f"{v:g}" for i, v in est.items()},
        **{f"T8_moe{i}": "12" for i in est},
    }
    row.update(overrides)
    return row


def _zip(tmp_path: Path, rows: list[dict[str, str]], members: int = 1) -> Path:
    text = io.StringIO()
    writer = csv.DictWriter(text, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    path = tmp_path / "2018thru2022-050-csv.zip"
    with zipfile.ZipFile(path, "w") as archive:
        for n in range(members):
            archive.writestr(f"{'050' if n == 0 else 'copy'}/Table8.csv", text.getvalue())
        archive.writestr("050/Table9.csv", "source\n")
    return path


def _ref(layer: str = "050", vintage: str = "2018-2022") -> ReleaseRef:
    return ReleaseRef("hud_chas_bulk", layer, vintage, "https://x", scope="NJ")


def test_refs_and_filenames_follow_hud_names() -> None:
    refs = HudChasBulkAdapter(states=["NJ"]).refs()
    assert [(r.layer, r.vintage) for r in refs] == [
        ("050", "2018-2022"),
        ("060", "2018-2022"),
    ]
    assert [HudChasBulkAdapter.filename(r) for r in refs] == [
        "2018thru2022-050-csv.zip",
        "2018thru2022-060-csv.zip",
    ]


def test_an_unreviewed_release_is_refused() -> None:
    """A release whose dictionary nobody read could have renumbered Table 8."""
    with pytest.raises(SourceError, match="not reviewed"):
        HudChasBulkAdapter(states=["NJ"]).refs("2019-2023")


def test_rows_in_scope_keep_every_count_and_margin(tmp_path: Path) -> None:
    path = _zip(tmp_path, [_row("0500000US34021"), _row("0500000US36001")])
    records = HudChasBulkAdapter.xlsx_records(path, _ref())
    assert len(records) == 1
    record = records[0]
    assert (record["level"], record["geo_key"]) == ("county", "34021")
    assert record["T8_est68"] == "200" and record["T8_moe133"] == "12"


def test_a_town_is_keyed_as_the_api_keys_it(tmp_path: Path) -> None:
    """`0600000US3402100100` is state, county and MCD; the API's key drops the county."""
    path = _zip(tmp_path, [_row("0600000US3402100100", sumlevel="060")])
    [record] = HudChasBulkAdapter.xlsx_records(path, _ref("060"))
    assert (record["level"], record["geo_key"]) == ("mcd", "3400100")


def test_rounding_within_slack_is_accepted(tmp_path: Path) -> None:
    path = _zip(tmp_path, [_row("0500000US34021", T8_est2="205")])
    assert HudChasBulkAdapter.xlsx_records(path, _ref())


@pytest.mark.parametrize(
    ("overrides", "match"),
    [
        # A column shifted by one band misses its subtotal by far more than rounding.
        ({"T8_est7": "60"}, "does not add up"),
        ({"source": "2017thru2021"}, "reads 2017thru2021"),
        ({"sumlevel": "060"}, "level 060"),
        ({"T8_est5": "n/a"}, "not a number"),
    ],
)
def test_a_changed_table_fails_rather_than_misreads(
    tmp_path: Path, overrides: dict[str, str], match: str
) -> None:
    path = _zip(tmp_path, [_row("0500000US34021", **overrides)])
    with pytest.raises(SourceError, match=match):
        HudChasBulkAdapter.xlsx_records(path, _ref())


def test_missing_columns_or_a_second_table_fail(tmp_path: Path) -> None:
    row = _row("0500000US34021")
    del row["T8_moe133"]
    with pytest.raises(SourceError, match="columns changed"):
        HudChasBulkAdapter.xlsx_records(_zip(tmp_path, [row]), _ref())
    two = _zip(tmp_path, [_row("0500000US34021")], members=2)
    with pytest.raises(SourceError, match="one Table8.csv"):
        HudChasBulkAdapter.xlsx_records(two, _ref())


def test_no_row_in_scope_fails(tmp_path: Path) -> None:
    path = _zip(tmp_path, [_row("0500000US36001")])
    with pytest.raises(SourceError, match="no rows"):
        HudChasBulkAdapter.xlsx_records(path, _ref())
