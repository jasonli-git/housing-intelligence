"""The property-tax lookup's data: one file per municipality, for object storage
(Milestone 37, ARCHITECTURE #289).

A reader picks a town and finds a property by address or by block and lot, and the page
shows its assessment and last year's tax from MOD-IV, the market value the state's ratio
implies, how the assessment compares with the town's of the same class, and the town's
revaluation context. 3,077,980 assessed parcels would be 154 times the static host's
file cap as pages, so they are served as 564 files from R2 — fetched only when someone
searches that town — and never as pages or API endpoints.

**Never an owner.** The files carry where a parcel is and what is assessed on it, and
nothing that names or reaches its owner: the adapter never requests those fields
(`hip.sources.nj_modiv.OWNER_FIELDS`), so they are not here to leave out. Sale price is
left out too: MOD-IV's has no usability flag, and 397,155 one- to four-family parcels
record $1 (#179); SR1A is where sales are read.

Read from the landed Parquet and the warehouse, beside `hip.publish` rather than inside
a pipeline stage: this is a rendering of what is held, as the API files are.

**One search for the state** (Milestone 38, ARCHITECTURE #294). Beside the town files, a
street index: `parcels/streets/<two letters>.json`, each street name normalised as
`hip.addresses` writes it, the towns that have it and the house numbers on it there, so
the page reads one small file and then only the town that holds the address. Its
`meta.json` carries the towns' names and district codes, which towns each ZIP code
reaches by HUD's crosswalk, and the street-word table the page normalises with. Parcels
withdrawn under Daniel's Law (`hip.removals`) are left out of both.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import Engine, text

from hip.addresses import parse, shard, street_words
from hip.duck import duckdb_session
from hip.removals import Filter, Removal

log = logging.getLogger(__name__)

# New Jersey's property classes (N.J.A.C. 18:12-2.2), as a reader would name them.
CLASSES: dict[str, str] = {
    "1": "Vacant land",
    "2": "Residential, one to four families",
    "3A": "Farm, with a house",
    "3B": "Farmland",
    "4A": "Commercial",
    "4B": "Industrial",
    "4C": "Apartments, five or more",
    "5A": "Railroad",
    "5B": "Railroad",
    "15A": "Public school",
    "15B": "Other school",
    "15C": "Public property",
    "15D": "Church or charity",
    "15E": "Cemetery",
    "15F": "Other exempt",
}

# A parcel row, in this order. Kept as arrays rather than objects: 3 million rows of
# repeated keys would double the files for nothing.
COLUMNS = (
    "block",
    "lot",
    "qualifier",
    "address",
    "class",
    "land",
    "improvement",
    "assessed",
    "tax",
    "year_built",
    "dwellings",
    "building",
)


@dataclass(frozen=True)
class ParcelFile:
    path: str
    parcels: int
    bytes: int
    sha256: str


def _context(engine: Engine, tax_year: int) -> dict[str, dict[str, object]]:
    """Per municipality geoid: the town's name and county, its Director's Ratio for the
    assessment's tax year and the newest, its last revaluation, and its newest rates."""
    rows: dict[str, dict[str, object]] = {}
    with engine.connect() as conn:
        towns = conn.execute(
            text(
                """
                SELECT m.geoid, m.name, c.name AS county
                FROM regions m JOIN regions c ON c.region_id = m.parent_id
                WHERE m.level = 'municipality'
                """
            )
        ).mappings()
        for town in towns:
            rows[town["geoid"]] = {
                "geoid": town["geoid"],
                "municipality": town["name"],
                "county": town["county"],
            }
        latest = conn.execute(
            text(
                """
                SELECT DISTINCT ON (r.geoid, f.metric_id)
                       r.geoid, f.metric_id, f.value, extract(year FROM f.period_end)::int
                           AS year
                FROM fact_metric_observation f JOIN regions r USING (region_id)
                WHERE r.level = 'municipality'
                  AND f.metric_id IN ('nj_director_ratio', 'nj_revaluation_year',
                                      'nj_effective_tax_rate', 'nj_general_tax_rate')
                ORDER BY r.geoid, f.metric_id, f.period_end DESC
                """
            )
        ).mappings()
        for row in latest:
            if row["geoid"] in rows:
                rows[row["geoid"]][row["metric_id"]] = {
                    "year": row["year"],
                    "value": row["value"],
                }
        assessed_year = conn.execute(
            text(
                """
                SELECT r.geoid, f.value
                FROM fact_metric_observation f JOIN regions r USING (region_id)
                WHERE r.level = 'municipality' AND f.metric_id = 'nj_director_ratio'
                  AND extract(year FROM f.period_end) = :year
                """
            ),
            {"year": tax_year},
        )
        for geoid, value in assessed_year:
            if geoid in rows:
                # The ratio of the assessment's own year: what turns that assessment
                # into the state's estimate of market value.
                rows[geoid]["assessment_ratio"] = {"year": tax_year, "value": value}
    return rows


def export(
    root: Path,
    *,
    parquet_dir: Path,
    engine: Engine,
    tax_year: int,
    towns: set[str] | None = None,
    removals: Sequence[Removal] = (),
) -> list[ParcelFile]:
    """Write `parcels/<municipality geoid>.json` under `root`, one per town, or only
    the `towns` named, and the street index over them, leaving out `removals`."""
    context = _context(engine, tax_year)
    with engine.connect() as conn:
        # NJ's CD code for each town, which `region_identifiers` has held since #184.
        codes = conn.execute(
            text(
                """
                SELECT i.identifier, r.geoid
                FROM region_identifiers i JOIN regions r USING (region_id)
                WHERE i.scheme = 'nj_cd_code'
                """
            )
        ).all()
    out_dir = root / "parcels"
    out_dir.mkdir(parents=True, exist_ok=True)
    parquet = parquet_dir / "nj_modiv" / "*" / "statewide.parquet"
    with duckdb_session() as con:
        con.execute("CREATE TEMP TABLE region_codes (identifier VARCHAR, geoid VARCHAR)")
        con.executemany(
            "INSERT INTO region_codes VALUES (?, ?)",
            [tuple(c) for c in codes if towns is None or c[1] in towns],
        )
        rows = con.execute(
            f"""
            SELECT c.geoid,
                   trim(p.PCLBLOCK), trim(p.PCLLOT), nullif(trim(p.PCLQCODE), ''),
                   nullif(trim(p.PROP_LOC), ''), trim(p.PROP_CLASS),
                   p.LAND_VAL, p.IMPRVT_VAL, p.NET_VALUE, p.LAST_YR_TX,
                   nullif(p.YR_CONSTR, 0), nullif(p.DWELL, 0),
                   nullif(trim(p.BLDG_DESC), '')
            FROM read_parquet('{parquet}') p
            JOIN region_codes c ON c.identifier = p.CD_CODE
            WHERE p.PROP_CLASS IS NOT NULL AND trim(p.PROP_CLASS) <> ''
            ORDER BY c.geoid, p.PCLBLOCK, p.PCLLOT, p.PCLQCODE
            """
        ).fetchall()

    withdrawn = Filter(list(removals))
    by_town: dict[str, list[list[object]]] = {}
    for geoid, *values in rows:
        block, lot, qualifier, address = values[0], values[1], values[2], values[3]
        if withdrawn.withdrawn(geoid, block, lot, qualifier, address):
            continue
        by_town.setdefault(geoid, []).append(list(values))
    for removal in withdrawn.unmatched():
        # Not an error: a lot can be merged away. But a withdrawal that matches nothing
        # deserves a look, in case the parcel came back under a number the list missed.
        log.warning(
            "address removal received %s matched no parcel in %s (block %s, lot %s)",
            removal.received,
            removal.geoid,
            removal.block,
            removal.lot,
        )

    written = []
    for geoid, parcels in sorted(by_town.items()):
        town = context.get(geoid, {"geoid": geoid})
        payload = json.dumps(
            {
                **town,
                "tax_year": tax_year,
                "classes": CLASSES,
                "columns": COLUMNS,
                "parcels": parcels,
            },
            separators=(",", ":"),
        ).encode()
        relative = f"parcels/{geoid}.json"
        (root / relative).write_bytes(payload)
        written.append(
            ParcelFile(
                path=relative,
                parcels=len(parcels),
                bytes=len(payload),
                sha256=hashlib.sha256(payload).hexdigest(),
            )
        )
    cd_codes = {geoid: code for code, geoid in codes}
    written.extend(_street_index(root, by_town, context, cd_codes, _zip_towns(engine)))
    return written


def _zip_towns(engine: Engine) -> dict[str, list[str]]:
    """The towns each ZIP code reaches, most of its residential addresses first, by
    HUD's crosswalk weights — the order a typed ZIP ranks the street's towns in."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT z.geoid, m.geoid
                FROM region_crosswalk x
                JOIN regions z ON z.region_id = x.from_region_id AND z.level = 'zip'
                JOIN regions m
                  ON m.region_id = x.to_region_id AND m.level = 'municipality'
                ORDER BY z.geoid, x.weight DESC, m.geoid
                """
            )
        ).all()
    zips: dict[str, list[str]] = {}
    for zip_code, geoid in rows:
        if geoid not in zips.setdefault(zip_code, []):
            zips[zip_code].append(geoid)
    return zips


def _number_key(number: str) -> tuple[int, str]:
    digits = "".join(c for c in number.split("-")[0] if c.isdigit())
    return (int(digits) if digits else 0, number)


def _write(root: Path, relative: str, payload: object, parcels: int) -> ParcelFile:
    body = json.dumps(payload, separators=(",", ":")).encode()
    (root / relative).write_bytes(body)
    return ParcelFile(
        path=relative,
        parcels=parcels,
        bytes=len(body),
        sha256=hashlib.sha256(body).hexdigest(),
    )


def _street_index(
    root: Path,
    by_town: dict[str, list[list[object]]],
    context: dict[str, dict[str, object]],
    cd_codes: dict[str, str],
    zips: dict[str, list[str]],
) -> list[ParcelFile]:
    """`parcels/streets/<shard>.json`: {street: {town geoid: [house numbers]}}, and
    `parcels/streets/meta.json`. A street whose addresses carry no house number is listed
    with an empty list, so the page can still say which towns have it."""
    shards: dict[str, dict[str, dict[str, set[str]]]] = {}
    address_column = COLUMNS.index("address")
    for geoid, parcels in by_town.items():
        for parcel in parcels:
            address = parcel[address_column]
            if not address:
                continue
            parsed = parse(str(address))
            key = shard(parsed.street)
            if not key:
                continue
            on_street = shards.setdefault(key, {}).setdefault(parsed.street, {})
            numbers = on_street.setdefault(geoid, set())
            if parsed.number is not None:
                numbers.add(parsed.number)

    out_dir = root / "parcels" / "streets"
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for key, streets in sorted(shards.items()):
        payload = {
            street: {
                geoid: sorted(numbers, key=_number_key)
                for geoid, numbers in sorted(on_street.items())
            }
            for street, on_street in sorted(streets.items())
        }
        written.append(_write(root, f"parcels/streets/{key}.json", payload, 0))

    towns = {
        geoid: [
            str(context.get(geoid, {}).get("municipality", geoid)),
            str(context.get(geoid, {}).get("county", "")),
            # The state's district code, which the county boards' own lookups take.
            cd_codes.get(geoid, ""),
        ]
        for geoid in sorted(by_town)
    }
    meta = {
        "shards": sorted(shards),
        "towns": towns,
        "zips": {z: [g for g in gs if g in towns] for z, gs in sorted(zips.items())},
        "words": street_words(),
    }
    written.append(_write(root, "parcels/streets/meta.json", meta, 0))
    return written


def find_by_address(
    parquet_dir: Path, engine: Engine, geoid: str, address: str
) -> list[tuple[str, str, str | None, str]]:
    """The parcels in one town at `address` — block, lot, qualifier and the assessor's
    spelling — matched by house number and normalised street, as the page matches.
    Condominium units share an address, so there may be several."""
    with engine.connect() as conn:
        codes = [
            row[0]
            for row in conn.execute(
                text(
                    """
                    SELECT i.identifier
                    FROM region_identifiers i JOIN regions r USING (region_id)
                    WHERE i.scheme = 'nj_cd_code' AND r.geoid = :geoid
                    """
                ),
                {"geoid": geoid},
            )
        ]
    if not codes:
        return []
    wanted = parse(address)
    parquet = parquet_dir / "nj_modiv" / "*" / "statewide.parquet"
    with duckdb_session() as con:
        rows = con.execute(
            f"""
            SELECT DISTINCT trim(PCLBLOCK), trim(PCLLOT), nullif(trim(PCLQCODE), ''),
                   trim(PROP_LOC)
            FROM read_parquet('{parquet}')
            WHERE CD_CODE IN (SELECT unnest(?)) AND PROP_LOC IS NOT NULL
            """,
            [codes],
        ).fetchall()
    return [
        (block, lot, qualifier, spelled)
        for block, lot, qualifier, spelled in rows
        if parse(spelled) == wanted
    ]
