"""Public FCC files handed in through the website, not a Fabric license.

Manual acquisition is an integration choice until a documented authenticated API
is configured, not a claim that FCC prohibits automatic downloads. Do not turn a
Census place into a legal municipality, or infer a denominator from served rows.

Two kinds of file: the published summaries, and two per-state location files
(served/unserved and fiber) that are reduced to counts per census block as they land.
Their rows carry CostQuest's Location IDs, so nothing finer than a block is kept.
"""

import csv
import io
import json
import math
import re
import zipfile
from datetime import date
from pathlib import Path
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError
from hip.sources.community import record

FCC_DOWNLOAD = "https://broadbandmap.fcc.gov/data-download"
SPEEDS = (
    "speed_02_02",
    "speed_10_1",
    "speed_25_3",
    "speed_100_20",
    "speed_250_25",
    "speed_1000_100",
)
TECHNOLOGIES = {"All Wired", "Fiber", "Cable"}
COUNTIES = {f"34{i:03d}" for i in range(1, 42, 2)}
MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
]


def vintage_dates(vintage: str) -> tuple[date, date]:
    try:
        as_of, revision = (date.fromisoformat(v) for v in vintage.split("_"))
    except ValueError as exc:
        raise SourceError("FCC vintage must be <as-of-date>_<revision-date>") from exc
    if (as_of.month, as_of.day) not in {(6, 30), (12, 31)} or revision < as_of:
        raise SourceError("FCC vintage must name a filing half-year and later revision")
    return as_of, revision


def file_stamp(vintage: str) -> str:
    """FCC's own file suffix for a vintage: `D25_29sep2026` for 2025-12-31_2026-09-29."""
    as_of, revision = vintage_dates(vintage)
    period = f"{'J' if as_of.month == 6 else 'D'}{as_of.year % 100:02d}"
    month = MONTHS[revision.month - 1]
    return f"{period}_{revision.day:02d}{month}{revision.year}"


class BroadbandSummaryAdapter(SourceAdapter):
    source_id: ClassVar[str] = "fcc_bdc"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    default_vintage: ClassVar[str] = "2025-12-31_2026-09-29"
    landing_format: ClassVar[str] = "xlsx_records"
    manual: ClassVar[bool] = True
    manual_from: ClassVar[str] = FCC_DOWNLOAD

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        value = vintage or self.newest or self.default_vintage
        vintage_dates(value)
        # Cite the actual public download page. No fabricated direct-file URL or
        # undocumented endpoint, and no credential in the raw manifest.
        return [ReleaseRef(self.source_id, "summary", value, FCC_DOWNLOAD)]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return (
            f"bdc_us_fixed_broadband_summary_by_geography_{file_stamp(ref.vintage)}.zip"
        )

    def use_cached_vintage(self, raw_dir: Path) -> None:
        """Advance only from acquired files, never an unverified download or web date."""
        index = raw_dir / self.source_id / "index.json"
        if not index.exists():
            return
        try:
            data = json.loads(index.read_text())
        except json.JSONDecodeError:
            return
        if not isinstance(data, dict):
            return
        newest = self.newest or self.default_vintage
        layer = self.refs()[0].layer
        for key, sha in data.items():
            if not isinstance(key, str) or not isinstance(sha, str):
                continue
            match = re.fullmatch(
                rf"{layer}@(\d{{4}}-\d{{2}}-\d{{2}}_\d{{4}}-\d{{2}}-\d{{2}})", key
            )
            if match is None:
                continue
            try:
                ref = self.refs(match[1])[0]
            except SourceError:
                continue
            if self._from_cache(ref, raw_dir, sha) is not None:
                newest = max(newest, ref.vintage)
        self.newest = newest

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        as_of, revision = vintage_dates(ref.vintage)
        member = cls.filename(ref).replace(".zip", ".csv")
        required = {
            "area_data_type",
            "geography_type",
            "geography_id",
            "geography_desc",
            "total_units",
            "biz_res",
            "technology",
            *SPEEDS,
        }
        result = []
        seen: set[tuple[str, str]] = set()
        units_by_entity: dict[str, int] = {}
        try:
            with zipfile.ZipFile(path) as archive:
                if archive.namelist() != [member]:
                    raise SourceError(
                        "FCC ZIP does not match the declared period/revision"
                    )
                with archive.open(member) as zipped, io.TextIOWrapper(zipped) as stream:
                    rows = csv.DictReader(stream)
                    if not required <= set(rows.fieldnames or []):
                        raise SourceError("FCC summary columns changed")
                    for row in rows:
                        geoid, level = row["geography_id"], row["geography_type"]
                        if not (
                            (level == "State" and geoid == "34")
                            or (level == "County" and geoid in COUNTIES)
                        ):
                            continue
                        if row["area_data_type"] != "Total" or row["biz_res"] != "R":
                            continue
                        technology = row["technology"]
                        if technology not in TECHNOLOGIES:
                            continue
                        try:
                            units = int(row["total_units"])
                            shares = {k: float(row[k]) for k in SPEEDS}
                        except (ValueError, TypeError) as exc:
                            raise SourceError("FCC denominator or share missing") from exc
                        values = list(shares.values())
                        if (
                            units <= 0
                            or any(
                                not math.isfinite(v) or not 0 <= v <= 1 for v in values
                            )
                            or any(
                                b > a + 1e-9
                                for a, b in zip(values, values[1:], strict=False)
                            )
                        ):
                            raise SourceError(
                                "Invalid FCC denominator or speed-tier shares"
                            )
                        entity = f"{level.lower()}:{geoid}"
                        key = (entity, technology)
                        if key in seen or units_by_entity.get(entity, units) != units:
                            raise SourceError(
                                "Duplicate FCC row or inconsistent denominator"
                            )
                        seen.add(key)
                        units_by_entity[entity] = units
                        result.append(
                            record(
                                "broadband_summary",
                                entity,
                                technology,
                                {
                                    "name": row["geography_desc"],
                                    "technology": technology,
                                    "as_of": as_of.isoformat(),
                                    "revision": revision.isoformat(),
                                    "total_units": units,
                                    "biz_res": "R",
                                    "area_data_type": "Total",
                                    "shares": shares,
                                    "url": FCC_DOWNLOAD,
                                    "basis": (
                                        "FCC published unit shares for "
                                        "residential-service offers"
                                    ),
                                    "denominator": (
                                        "Units at all broadband-serviceable locations "
                                        "in the geography; not households"
                                    ),
                                },
                                as_of.isoformat(),
                            )
                        )
        except (zipfile.BadZipFile, UnicodeError, csv.Error) as exc:
            raise SourceError("Invalid FCC summary archive") from exc
        expected = {
            (entity, technology)
            for entity in {"state:34", *(f"county:{c}" for c in COUNTIES)}
            for technology in TECHNOLOGIES
        }
        if seen != expected:
            raise SourceError("FCC NJ summary incomplete: need state and 21 counties")
        return result


FCC_STATE_DOWNLOAD = "https://broadbandmap.fcc.gov/data-download/nationwide-data"
SERVED_FIELDS = (
    "location_id",
    "block_geoid",
    "h3_res8_id",
    "any_dl100_ul20",
    "wired_dl100_ul20",
    "terrestrial_dl100_ul20",
)
FIBER_FIELDS = {"location_id", "technology", "block_geoid"}
BLOCK = re.compile(r"34\d{13}")


class BroadbandLocationsAdapter(BroadbandSummaryAdapter):
    """New Jersey's location files, counted per 2020 census block (ARCHITECTURE #372).

    `served` lists every broadband-serviceable location once, with whether any wired,
    or any terrestrial, provider reports 100/20 Mbps there — numerator and denominator
    in one file, so no denominator is inferred from served rows. `fiber` lists each
    provider's fiber offer at a location; a location counts once however many reach
    it. Blocks reach towns and ZIP codes through LODES's crosswalk in staging.
    """

    source_id: ClassVar[str] = "fcc_bdc_locations"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    default_vintage: ClassVar[str] = "2025-12-31_2026-10-13"
    manual_from: ClassVar[str] = FCC_STATE_DOWNLOAD
    minimum: ClassVar[int] = 100_000

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        value = vintage or self.newest or self.default_vintage
        vintage_dates(value)
        return [
            ReleaseRef(self.source_id, layer, value, FCC_STATE_DOWNLOAD)
            for layer in ("served", "fiber")
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        kind = {
            "served": "fixed_broadband_served_unserved",
            "fiber": "FibertothePremises_fixed_broadband",
        }[ref.layer]
        # As the download page saves it; the API names the same bytes `.csv.zip`.
        return f"bdc_34_{kind}_{file_stamp(ref.vintage)}.zip"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        member = cls.filename(ref).replace(".zip", ".csv")
        try:
            with zipfile.ZipFile(path) as archive:
                if archive.namelist() != [member]:
                    raise SourceError("FCC ZIP does not match the declared file")
                with archive.open(member) as zipped, io.TextIOWrapper(zipped) as stream:
                    rows = csv.DictReader(stream)
                    blocks = (
                        cls._served(rows) if ref.layer == "served" else cls._fiber(rows)
                    )
        except (zipfile.BadZipFile, UnicodeError, csv.Error) as exc:
            raise SourceError("Invalid FCC location archive") from exc
        if len(blocks) < (cls.minimum if ref.layer == "served" else 1):
            raise SourceError(f"FCC {ref.layer} file covers too few blocks")
        return [{"block": block, **counts} for block, counts in sorted(blocks.items())]

    @staticmethod
    def _served(rows: csv.DictReader[str]) -> dict[str, dict[str, int]]:
        if tuple(rows.fieldnames or ()) != SERVED_FIELDS:
            raise SourceError("FCC served/unserved columns changed")
        seen: set[str] = set()
        blocks: dict[str, dict[str, int]] = {}
        for row in rows:
            location, block = row["location_id"], row["block_geoid"]
            flags = (
                row["any_dl100_ul20"],
                row["wired_dl100_ul20"],
                row["terrestrial_dl100_ul20"],
            )
            if location in seen or not BLOCK.fullmatch(block):
                raise SourceError("FCC served/unserved row is duplicated or unplaced")
            if any(flag not in {"0", "1"} for flag in flags):
                raise SourceError("FCC served flag is not 0 or 1")
            seen.add(location)
            counts = blocks.setdefault(
                block,
                {"locations": 0, "unserved_wired": 0, "unserved_terrestrial": 0},
            )
            counts["locations"] += 1
            counts["unserved_wired"] += flags[1] == "0"
            counts["unserved_terrestrial"] += flags[2] == "0"
        return blocks

    @staticmethod
    def _fiber(rows: csv.DictReader[str]) -> dict[str, dict[str, int]]:
        if not set(rows.fieldnames or ()) >= FIBER_FIELDS:
            raise SourceError("FCC fiber columns changed")
        located: dict[str, str] = {}
        for row in rows:
            location, block = row["location_id"], row["block_geoid"]
            if row["technology"] != "50" or not BLOCK.fullmatch(block):
                raise SourceError("FCC fiber row is not fiber in New Jersey")
            if located.setdefault(location, block) != block:
                raise SourceError("FCC fiber location sits in two blocks")
        blocks: dict[str, dict[str, int]] = {}
        for block in located.values():
            blocks.setdefault(block, {"fiber": 0})["fiber"] += 1
        return blocks
