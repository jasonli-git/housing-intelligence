"""HUD User datasets: the USPS crosswalk and income limits, Fair Market Rents, and CHAS.

Four datasets behind one token, serving affordability specifically (SPEC principle 4).
Three sources rather than one, because a source is what a reader sees credited beside a
figure: a Fair Market Rent labelled "USPS ZIP crosswalk and income limits" would be a
wrong citation on a correct number.

**The crosswalk** publishes residential, business, and total address ratios for
allocating ZIP-level data. `res_ratio` is the share of a ZIP's *residential addresses*
falling in each target geography, which is the right basis for housing measures — area
weighting treats a golf course like a subdivision. `type=11` (zip-countysub) reaches
municipalities directly, which is what supersedes the area weighting from Milestone 1.

**Income limits** publish HUD's area median income and the 30/50/80% thresholds every
housing agency uses. They let an affordability figure cite a published standard instead
of one the platform invented.

**Fair Market Rents** (Milestone 21) are HUD's rent standard, per FMR area and federal
fiscal year: the rent the voucher program pays against, and the benchmark rent burden
can cite in place of a survey median.

**CHAS** (Milestone 21) is HUD's custom tabulation of ACS microdata by tenure, income
band, and cost burden — published burden tables in place of the ratio the platform
derives from B25070.
"""

from __future__ import annotations

import csv
import io
import json
import os
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import ClassVar

from hip.config import ConfigError, fips_for
from hip.sources.base import (
    Discovery,
    Release,
    ReleaseRef,
    SourceAdapter,
    SourceError,
)

BASE_URL = "https://www.huduser.gov/hudapi/public"

# HUD crosswalk type codes. Only the two that reach our region levels are used.
CROSSWALK_TYPES = {"zip_county": 2, "zip_countysub": 11}

# Income limits: the newest fiscal year known to exist when this was written, and how
# many years back from the newest to fetch. HUD revises annually; five covers the change
# windows. The newest is discovered (Milestone 26): FY2025 and FY2026 were published while
# the platform went on requesting FY2024.
IL_FLOOR = 2024
IL_YEAR_COUNT = 5

# HUD publishes limits for 1-8 person households. Four-person is the conventional
# reference figure and the one policy documents quote, so it is the metric; every size
# and band is landed too, for the income check sized to a reader's household
# (Milestone 35).
HOUSEHOLD_SIZE = "p4"
HOUSEHOLD_SIZES = range(1, 9)
# HUD's three bands, by its own keys: extremely low (30%), very low (50%), low (80%).
INCOME_BANDS = {"extremely_low": "il30", "very_low": "il50", "low": "il80"}

# Fair Market Rents: the newest fiscal year in force when this was written, and how many
# years back to fetch. The API refuses FY2016 ("Invalid year"), which ten years from
# FY2026 reaches exactly. A newer fiscal year is discovered, and used only once in force.
FMR_FLOOR = 2026
FMR_YEAR_COUNT = 10


def fmr_in_force_from(fiscal_year: int) -> date:
    """The day a fiscal year's Fair Market Rents take effect: 1 October before it.

    HUD publishes them weeks earlier — FY2027's were answering by 2026-09-23 — and a
    figure published but not yet in force must not stand in for the one that is.
    """
    return date(fiscal_year - 1, 10, 1)


def _years(newest: int, count: int) -> list[int]:
    return list(range(newest, newest - count, -1))


# The CHAS vintage: HUD's tabulation of ACS 2018-2022, the latest it has published as of
# 2026-09-11 — 2019-2023 answers empty. Pinned rather than left to the API's default, so
# a re-run fetches the release it recorded. CHAS vintages overlap by four years as ACS
# ones do, and the ACS burden ratio already carries the trend, so one is loaded.
CHAS_VINTAGE = "2018-2022"

# HUD User allows 60 requests a minute per token (`x-ratelimit-limit: 60`); a little
# under that pace, for every HUD adapter, since the three share one token.
HUD_REQUEST_INTERVAL_S = 1.1

# CHAS summary levels (`type`): 3 is county, 4 is MCD. HUD's own list; a third-party
# mirror has 4 and 5 the other way round.
CHAS_COUNTY = 3
CHAS_MCD = 4


def _token() -> str:
    token = os.environ.get("HUD_API_TOKEN")
    if not token:
        raise ConfigError(
            "hud requires HUD_API_TOKEN. Free at "
            "https://www.huduser.gov/portal/dataset/uspszip-api.html"
        )
    return token


def _headers() -> dict[str, str]:
    """Bearer auth, built per instance so the token is never baked into a ClassVar
    shared by every adapter."""
    return {**SourceAdapter.headers, "Authorization": f"Bearer {_token()}"}


class HudAdapter(SourceAdapter):
    """Crosswalk and income limits, one release per dataset slice."""

    source_id: ClassVar[str] = "hud"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str], county_fips: list[str]) -> None:
        self.states = states
        self.county_fips = county_fips
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        _token()
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer=name,
                vintage=vintage or self.default_vintage,
                scope=state,
                url=f"{BASE_URL}/usps?type={code}&query={state}",
            )
            for name, code in CROSSWALK_TYPES.items()
            for state in self.states
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"il_{fips}",
                vintage=str(year),
                url=f"{BASE_URL}/il/data/{fips}99999?year={year}",
            )
            for year in _years(int(self.newest or IL_FLOOR), IL_YEAR_COUNT)
            for fips in self.county_fips
        ]
        return refs

    def discover(self, today: date) -> Discovery:
        """The newest income-limit year HUD answers for this state's first county.

        One county stands for all: HUD publishes a fiscal year's limits for every area
        at once, and asking 21 times would spend a third of the token's minute. The
        crosswalk half of this source is `current` and revalidated on age instead.
        """
        probe_fips = self.county_fips[0]

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(
                f"{BASE_URL}/il/data/{probe_fips}99999?year={year}", method="GET"
            )

        start = int(self.newest or IL_FLOOR)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        if not isinstance(payload, dict) or "data" not in payload:
            raise ValueError(f"hud/{ref.key}: no 'data' key in response")
        data = payload["data"]
        assert isinstance(data, dict)

        if ref.layer.startswith("il_"):
            return _income_limit_rows(data, ref)
        return _crosswalk_rows(data, ref)


def _crosswalk_rows(data: dict[str, object], ref: ReleaseRef) -> list[dict[str, object]]:
    results = data.get("results", [])
    assert isinstance(results, list)
    return [
        {
            "crosswalk_type": data.get("crosswalk_type"),
            # For zip-* types HUD puts the ZIP in `zip` and the target in `geoid`.
            "from_geoid": row["zip"],
            "to_geoid": row["geoid"],
            "res_ratio": row["res_ratio"],
            "tot_ratio": row["tot_ratio"],
        }
        for row in results
        if isinstance(row, dict) and row.get("res_ratio")
    ]


def _income_limit_rows(
    data: dict[str, object], ref: ReleaseRef
) -> list[dict[str, object]]:
    """One row per county-year, flattening the nested band structure.

    Every band and household size becomes a column, `il30_p1` to `il80_p8`, beside the
    four-person 80% limit the metric has always read.
    """
    low = data.get("low")
    limit_80 = low.get(f"il80_{HOUSEHOLD_SIZE}") if isinstance(low, dict) else None
    lines: dict[str, object] = {}
    for band, prefix in INCOME_BANDS.items():
        values = data.get(band)
        for size in HOUSEHOLD_SIZES:
            key = f"{prefix}_p{size}"
            lines[key] = values.get(key) if isinstance(values, dict) else None
    return [
        {
            # layer is 'il_<fips>'; the county FIPS is what joins to regions.
            "county_fips": ref.layer.removeprefix("il_"),
            "year": ref.vintage,
            "median_income": data.get("median_income"),
            "income_limit_80": limit_80,
            **lines,
        }
    ]


class HudFmrAdapter(SourceAdapter):
    """Fair Market Rents, one release per state per fiscal year.

    `/fmr/statedata/{state}` answers every county in a state in one call — 21 NJ
    counties in about 9KB — where the per-county endpoint the source list was sized on
    would take 21. Its metro-area block is not kept: every county entry already names its
    FMR area and carries the area's rents.
    """

    source_id: ClassVar[str] = "hud_fmr"
    default_vintage: ClassVar[str] = str(FMR_FLOOR)
    landing_format: ClassVar[str] = "json"
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str]) -> None:
        self.states = states
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        newest = int(self.newest or FMR_FLOOR)
        years = [int(vintage)] if vintage else _years(newest, FMR_YEAR_COUNT)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="fmr",
                vintage=str(year),
                scope=state,
                url=f"{BASE_URL}/fmr/statedata/{state}?year={year}",
            )
            for year in years
            for state in self.states
        ]

    def discover(self, today: date) -> Discovery:
        """The newest fiscal year *in force*; a newer published one waits as pending.

        Published and in force are different days for this source and only this one
        here: HUD releases a fiscal year's rents in late summer for 1 October. Using the
        published year as soon as it appears would show next year's standard as this
        year's for several weeks, on the one figure the voucher program pays against.
        """
        state = self.states[0]

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(
                f"{BASE_URL}/fmr/statedata/{state}?year={year}", method="GET"
            )

        start = int(self.newest or FMR_FLOOR)
        published_year, published, reached = self._probe_forward(start, exists)
        in_force = max(
            (
                y
                for y in range(start, published_year + 1)
                if fmr_in_force_from(y) <= today
            ),
            default=start,
        )
        pending = published_year if published_year > in_force else None
        return self._discovered(
            str(in_force),
            reached=reached,
            published=published if pending is None else None,
            pending=str(pending) if pending else None,
            pending_from=fmr_in_force_from(pending) if pending else None,
        )

    def child_refs(
        self, release: Release, vintage: str | None = None
    ) -> list[ReleaseRef]:
        """Small Area FMRs for each county the statewide file marks as priced by ZIP.

        Milestone 35. HUD sets Fair Market Rents by ZIP code in some metro areas — nine
        New Jersey counties in FY2026 — and the statewide file says which, with
        `smallarea_status`, but carries only the metro figure. The county endpoint
        answers every ZIP in the county, one request each.
        """
        if release.ref.layer != "fmr":
            return []
        payload = json.loads(release.path.read_text())
        data = payload.get("data") if isinstance(payload, dict) else None
        counties = data.get("counties") if isinstance(data, dict) else None
        if not isinstance(counties, list):
            return []
        year = release.ref.vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"safmr_{str(entry['fips_code'])[:5]}",
                vintage=year,
                url=f"{BASE_URL}/fmr/data/{entry['fips_code']}?year={year}",
            )
            for entry in counties
            if isinstance(entry, dict)
            and str(entry.get("smallarea_status")) == "1"
            and str(entry.get("fips_code", "")).endswith("99999")
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        data = payload.get("data") if isinstance(payload, dict) else None
        if ref.layer.startswith("safmr_"):
            return _safmr_rows(data, ref)
        counties = data.get("counties") if isinstance(data, dict) else None
        if not isinstance(counties, list):
            raise ValueError(f"hud_fmr/{ref.key}: no 'data.counties' in response")
        return [
            {
                # Ten digits: county FIPS then 99999 for a whole county. New England
                # entries carry a town code there instead; dbt keeps whole counties.
                "fips_code": entry.get("fips_code"),
                "county_name": entry.get("county_name"),
                "fmr_area": entry.get("metro_name"),
                "small_area": entry.get("smallarea_status"),
                "fmr_percentile": entry.get("FMR Percentile"),
                "efficiency": entry.get("Efficiency"),
                "one_bedroom": entry.get("One-Bedroom"),
                "two_bedroom": entry.get("Two-Bedroom"),
                "three_bedroom": entry.get("Three-Bedroom"),
                "four_bedroom": entry.get("Four-Bedroom"),
                "fiscal_year": ref.vintage,
            }
            for entry in counties
            if isinstance(entry, dict)
        ]


def _safmr_rows(data: object, ref: ReleaseRef) -> list[dict[str, object]]:
    """One row per ZIP. The metro row HUD lists first ("MSA level") is not a ZIP."""
    rows = data.get("basicdata") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise ValueError(f"hud_fmr/{ref.key}: no 'data.basicdata' list in response")
    return [
        {
            "zip_code": str(row.get("zip_code")),
            "county_fips": ref.layer.removeprefix("safmr_"),
            "efficiency": row.get("Efficiency"),
            "one_bedroom": row.get("One-Bedroom"),
            "two_bedroom": row.get("Two-Bedroom"),
            "three_bedroom": row.get("Three-Bedroom"),
            "four_bedroom": row.get("Four-Bedroom"),
            "fiscal_year": ref.vintage,
        }
        for row in rows
        if isinstance(row, dict) and str(row.get("zip_code", "")).isdigit()
    ]


class HudChasAdapter(SourceAdapter):
    """CHAS tables, one release per county and one per municipality.

    Municipal refs cannot be listed from config: they are HUD's MCD codes, and HUD
    publishes the list. So the directory (`chas/listMCDs/{state}`) is fetched as a
    release like any other, cached like any other, and the municipal refs are derived
    from its content — which keeps a re-run, and `hip load` rebuilding provenance, off
    the network once it is cached.
    """

    source_id: ClassVar[str] = "hud_chas"
    default_vintage: ClassVar[str] = CHAS_VINTAGE
    landing_format: ClassVar[str] = "json"
    # 571 municipal calls paced at HUD's 60-a-minute limit — about ten minutes, and the
    # source of the 429 that stopped Milestone 21's first run. CHAS is published in
    # multi-year releases, so a month between unvalidatable re-fetches is generous.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str], county_fips: list[str]) -> None:
        self.states = states
        self.county_fips = county_fips
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """County refs and each state's MCD directory; municipal refs follow from it."""
        year = vintage or self.newest or self.default_vintage
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"county_{fips}",
                vintage=year,
                url=(
                    f"{BASE_URL}/chas?type={CHAS_COUNTY}&year={year}"
                    f"&stateId={int(fips[:2])}&entityId={int(fips[2:])}"
                ),
            )
            for fips in self.county_fips
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                layer="mcds",
                # The directory lists what exists now, not a vintage of the data.
                vintage="current",
                scope=state,
                url=f"{BASE_URL}/chas/listMCDs/{int(fips_for(state))}",
            )
            for state in self.states
        ]
        return refs

    def discover(self, today: date) -> Discovery:
        """The newest CHAS span HUD has tabulated, probed on the first county.

        HUD answers an untabulated span with `[]` and a 200, not an error, so existence
        is read from the body: 2019-2023 and 2020-2024 both answered empty on 2026-09-23.
        Spans move a year at a time (`2018-2022` → `2019-2023`).
        """
        fips = self.county_fips[0]

        def exists(first: int) -> tuple[bool | None, str | None]:
            span = f"{first}-{first + 4}"
            response = self._ask(
                f"{BASE_URL}/chas?type={CHAS_COUNTY}&year={span}"
                f"&stateId={int(fips[:2])}&entityId={int(fips[2:])}"
            )
            if response is None or not response.is_success:
                return None, None
            try:
                rows = response.json()
            except ValueError:
                return None, None
            return (isinstance(rows, list) and len(rows) > 0), None

        start = int((self.newest or self.default_vintage)[:4])
        first, _, reached = self._probe_forward(start, exists)
        return self._discovered(f"{first}-{first + 4}", reached=reached)

    def child_refs(
        self, release: Release, vintage: str | None = None
    ) -> list[ReleaseRef]:
        """The 571 municipal refs, which only exist once the directory is on disk.

        Was an override of `fetch_all`, which meant the resilient acquisition path in
        `hip.refresh` — which drives `refs()` and `fetch()` directly so it can carry on
        past a failure — never saw them at all.
        """
        if release.ref.layer != "mcds":
            return []
        return self.municipal_refs(release, vintage)

    def municipal_refs(self, directory: Release, vintage: str | None) -> list[ReleaseRef]:
        """One ref per MCD in a fetched directory."""
        year = vintage or self.newest or self.default_vintage
        entries = json.loads(directory.path.read_text())
        if not isinstance(entries, list):
            raise ValueError(f"hud_chas/{directory.ref.key}: directory is not a list")
        state = fips_for(directory.ref.scope or "")
        return [
            ReleaseRef(
                source_id=self.source_id,
                # State FIPS and the five-digit MCD code: the key dbt resolves to a
                # municipal GEOID through TIGER, since a CHAS row names no county code.
                layer=f"mcd_{state}{int(entry['entityId']):05d}",
                vintage=year,
                url=(
                    f"{BASE_URL}/chas?type={CHAS_MCD}&year={year}"
                    f"&stateId={int(state)}&entityId={int(entry['entityId'])}"
                ),
            )
            for entry in entries
            if isinstance(entry, dict)
            and str(entry.get("statecode")) == state
            # Code 0 is "County subdivisions not defined" — the water areas, listed once
            # per coastal county (five times for NJ). Not a municipality, and TIGER's
            # 00000 is filtered for the same reason.
            and int(entry["entityId"]) != 0
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        if ref.layer == "mcds":
            if not isinstance(payload, list):
                raise ValueError(f"hud_chas/{ref.key}: directory is not a list")
            return [
                {
                    "statecode": entry.get("statecode"),
                    "entity_id": entry.get("entityId"),
                    "mcd_name": entry.get("mcdname"),
                }
                for entry in payload
                if isinstance(entry, dict)
            ]
        if not isinstance(payload, list):
            raise ValueError(f"hud_chas/{ref.key}: expected a list of rows")
        level, geo_key = ref.layer.split("_", 1)
        if not payload:
            # HUD answers `[]` for a listed MCD it tabulated nothing for. One keyed row
            # with no values lands it honestly — landing refuses an empty table, and
            # dropping the release would lose the record that HUD was asked.
            return [{"level": level, "geo_key": geo_key, "chas_year": None}]
        # Every field kept, as HUD sends it: the dictionary has 132 and the burden
        # metrics use a handful, so a later metric needs a dbt column, not a re-fetch.
        return [
            {"level": level, "geo_key": geo_key, "chas_year": row.get("year"), **row}
            for row in payload
            if isinstance(row, dict)
        ]


# HUD's bulk CHAS files (#353): the same tabulation as the API, with a 90% margin of
# error beside every count, which the API leaves out. HUD's download page answers a
# script with an empty 202, so they are downloaded by hand, one ZIP per summary level.
CHAS_PAGE = "https://www.huduser.gov/portal/datasets/cp.html"
CHAS_BULK_LEVELS = {"050": "county", "060": "mcd"}
# Releases whose Table 8 layout was read against HUD's data dictionary for that release
# (`CHAS-data-dictionary-18-22.xlsx`, 2026-10-08). Another release fails until its
# dictionary is read, so a renumbered column cannot attach a margin to the wrong count.
CHAS_BULK_REVIEWED = frozenset({"2018-2022"})
CHAS_TABLE8_COLUMNS = 133
# Table 8: tenure by household income by cost burden. Each income band's subtotal is
# followed by its burden subtotals at +1 (up to 30%), +4 (30-50%), +7 (over 50%) and +10
# (not computed); owners' five bands start at 3, renters' at 69.
CHAS_OWNER_BANDS = (3, 16, 29, 42, 55)
CHAS_RENTER_BANDS = (69, 82, 95, 108, 121)
# HUD rounds every count to the nearest 5, so a subtotal and the sum of its parts can
# differ by a few households: up to 11 in New Jersey's 2018-2022 files. A shifted or
# renumbered column misses by far more.
CHAS_ROUNDING_SLACK = 15.0


class HudChasBulkAdapter(SourceAdapter):
    """Table 8 of HUD's bulk CHAS files, for the margins the API does not carry.

    Every Table 8 count and margin is kept for the configured states, as HUD sends it;
    `stg_hud_chas` sums the income bands into the API's burden counts and attaches a
    margin only where the two agree exactly (`dbt/tests/chas_bulk_matches_api.sql`).
    """

    source_id: ClassVar[str] = "hud_chas_bulk"
    default_vintage: ClassVar[str] = CHAS_VINTAGE
    landing_format: ClassVar[str] = "xlsx_records"
    manual: ClassVar[bool] = True
    manual_from: ClassVar[str | None] = f"HUD User's CHAS page ({CHAS_PAGE})"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        if year not in CHAS_BULK_REVIEWED:
            raise SourceError(
                f"CHAS {year}: Table 8 is not reviewed against that release's dictionary"
            )
        return [
            ReleaseRef(
                self.source_id, level, year, CHAS_PAGE, scope=",".join(self.states)
            )
            for level in CHAS_BULK_LEVELS
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        first, last = ref.vintage.split("-")
        return f"{first}thru{last}-{ref.layer}-csv.zip"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        if ref.vintage not in CHAS_BULK_REVIEWED or ref.layer not in CHAS_BULK_LEVELS:
            raise SourceError(f"hud_chas_bulk/{ref.key}: not a reviewed release")
        states = {fips_for(s).lstrip("0") for s in (ref.scope or "").split(",") if s}
        if not states:
            raise SourceError(f"hud_chas_bulk/{ref.key}: no states in scope")
        counts = [f"T8_est{i}" for i in range(1, CHAS_TABLE8_COLUMNS + 1)]
        margins = [f"T8_moe{i}" for i in range(1, CHAS_TABLE8_COLUMNS + 1)]
        source = ref.vintage.replace("-", "thru")
        level = CHAS_BULK_LEVELS[ref.layer]
        with zipfile.ZipFile(path) as archive:
            members = [n for n in archive.namelist() if n.split("/")[-1] == "Table8.csv"]
            if len(members) != 1:
                raise SourceError(f"hud_chas_bulk/{ref.key}: expected one Table8.csv")
            with archive.open(members[0]) as raw:
                rows = csv.DictReader(io.TextIOWrapper(raw, encoding="latin-1"))
                header = set(rows.fieldnames or [])
                if (
                    not {"source", "sumlevel", "geoid", "name", "st", *counts, *margins}
                    <= header
                ):
                    raise SourceError(f"hud_chas_bulk/{ref.key}: Table 8 columns changed")
                records = []
                for row in rows:
                    if row["st"].lstrip("0") not in states:
                        continue
                    if row["source"] != source or row["sumlevel"] != ref.layer:
                        raise SourceError(
                            f"hud_chas_bulk/{ref.key}: a row reads {row['source']} "
                            f"level {row['sumlevel']}"
                        )
                    cls._check_numbers(row, counts + margins, ref)
                    cls._check_sums(row, ref)
                    # `0500000US34021` → `34021`; `0600000US3402100100` → state and MCD
                    # code, `3400100`, the key the API's municipal releases carry.
                    geo = row["geoid"].split("US", 1)[1]
                    geo_key = geo if level == "county" else geo[:2] + geo[5:]
                    records.append(
                        {
                            "level": level,
                            "geo_key": geo_key,
                            "name": row["name"],
                            **{c: row[c] for c in counts + margins},
                        }
                    )
        if not records:
            raise SourceError(f"hud_chas_bulk/{ref.key}: no rows for {sorted(states)}")
        return records

    @staticmethod
    def _check_numbers(row: dict[str, str], columns: list[str], ref: ReleaseRef) -> None:
        """Every count and margin is a non-negative number; HUD uses no special codes."""
        for column in columns:
            try:
                ok = float(row[column]) >= 0
            except ValueError:
                ok = False
            if not ok:
                raise SourceError(
                    f"hud_chas_bulk/{ref.key}: {row['geoid']} {column} is not a number"
                )

    @staticmethod
    def _check_sums(row: dict[str, str], ref: ReleaseRef) -> None:
        """Refuse a table whose parts do not add up to its subtotals within rounding."""

        def count(i: int) -> float:
            return float(row[f"T8_est{i}"])

        checks = [(count(1), [count(2), count(68)])]
        for total, bands in ((2, CHAS_OWNER_BANDS), (68, CHAS_RENTER_BANDS)):
            checks.append((count(total), [count(b) for b in bands]))
            checks += [(count(b), [count(b + k) for k in (1, 4, 7, 10)]) for b in bands]
        for whole, parts in checks:
            if abs(whole - sum(parts)) > CHAS_ROUNDING_SLACK:
                raise SourceError(
                    f"hud_chas_bulk/{ref.key}: {row['geoid']} Table 8 does not add up"
                )
