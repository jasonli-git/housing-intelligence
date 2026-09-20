"""CSV → Parquet. Pure transcoding, like the shapefile lander.

Column names are preserved verbatim, including Zillow's ~318 date columns. Reshaping is
dbt's job at the `stage` stage; keeping landing dumb is what makes it re-runnable from
`data/raw/` when a modelling bug is found, without re-downloading 245MB.
"""

from __future__ import annotations

import json
import tempfile
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.sources.base import Release, SourceAdapter

# How much of a worksheet to ask for. Wider and taller than any sheet these sources
# publish, because `read_xlsx` silently under-reads when left to infer the range.
XLSX_RANGE = "A1:BZ900"


def parquet_path(release: Release, parquet_dir: Path) -> Path:
    ref = release.ref
    name = f"{ref.layer}_{ref.scope}" if ref.scope else ref.layer
    return parquet_dir / ref.source_id / ref.vintage / f"{name}.parquet"


def _stamp_path(out: Path) -> Path:
    """Where the sha256 of the release that produced `out` is recorded."""
    return out.with_suffix(".parquet.src")


def needs_landing(release: Release, out: Path, overwrite: bool) -> bool:
    """Whether `out` must be rebuilt from `release`.

    The existence check alone was wrong, and silently. `parquet_path` keys on the
    release's *vintage*, and for every source whose vintage is the literal string
    `current` — Zillow, FHFA, FRED, BLS, MOD-IV — successive releases map to one path.
    So a genuinely new release landed on top of an existing file, found it present, and
    was skipped: `hip land` registered the new release in `source_releases` while the
    Parquet behind it stayed whatever it was the first time.

    Measured on 2026-09-06: Zillow's August release carried a `2026-07-31` column that
    the raw tier had correctly stored and the warehouse never saw, because
    `data/parquet/zillow_zhvi/current/county.parquet` still had the mtime of the
    previous month's run. The raw tier is content-addressed and got this right; the
    landing tier keyed on a mutable string and did not.

    Fixed by recording the producing release's sha256 beside the Parquet and comparing
    against it, which keeps the skip — transcoding 1.1GB of MOD-IV on every run is a
    real cost — while making it answer the right question.
    """
    if overwrite or not out.exists():
        return True
    stamp = _stamp_path(out)
    if not stamp.exists():
        # Landed before stamps existed. Rebuild once, so the stamp is written and
        # every later run can trust it.
        return True
    return stamp.read_text().strip() != release.sha256


def record_landed(release: Release, out: Path) -> None:
    """Note which release produced `out`, for `needs_landing` to compare against."""
    _stamp_path(out).write_text(release.sha256 + "\n")


def land_csv(
    release: Release,
    *,
    parquet_dir: Path,
    overwrite: bool = False,
    csv_options: str = "",
) -> LandedTable:
    """Transcode one CSV to Parquet, letting DuckDB infer types over the whole file."""
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            # sample_size=-1: Zillow's leading rows are frequently empty for newer
            # geographies, and a sampled inference reads those columns as VARCHAR and
            # then silently drops every value that will not cast.
            # encoding='latin-1': IRS SOI files carry non-UTF-8 bytes in county names
            # (line 2333 of countyinflow2122.csv), which aborts a UTF-8 read outright.
            # latin-1 decodes every byte, so no row is dropped.
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_csv('{release.path}',
                                           header=true, sample_size=-1,
                                           encoding='latin-1'{csv_options})
                ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            )
            record_landed(release, out)
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )


def land_ndjson(
    release: Release,
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Transcode newline-delimited JSON to Parquet without going through Python.

    `land_json` parses the whole payload into Python objects, which is fine for the
    hundred-row responses HUD and FRED return and impossible for 3.48M parcels. DuckDB
    streams NDJSON straight to Parquet, so peak memory is a scan buffer rather than the
    file. The adapter has already flattened each line to one object, so there is no
    `to_records` step to run.
    """
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            # sample_size=-1 for the same reason as the CSV lander: MOD-IV leaves
            # numeric columns null for long runs of unmatched parcels, and a sampled
            # inference types them as VARCHAR and then drops every value that will
            # not cast.
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_json_auto('{release.path}',
                                                 format='newline_delimited',
                                                 sample_size=-1)
                ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            )
            record_landed(release, out)
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )


def land_json(
    release: Release,
    adapter: type[SourceAdapter],
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Transcode a JSON API response to Parquet via the adapter's row shape.

    The adapter owns the flattening (`to_records`), because every JSON API nests its
    data differently and that is publisher knowledge. Landing still adds no business
    logic: it writes exactly the rows the adapter reports, with the keys it reports.
    """
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            payload = json.loads(release.path.read_text())
            records = adapter.to_records(payload, release.ref)
            if not records:
                raise ValueError(f"{release.ref.source_id}/{release.ref.key}: no rows")
            # Register the records as a DuckDB relation via a temporary JSON file
            # rather than building a giant INSERT: types are inferred once, and the
            # column set follows the adapter without being declared twice.
            staging = out.with_suffix(".ndjson")
            staging.write_text("\n".join(json.dumps(r) for r in records))
            con.execute(
                f"COPY (SELECT * FROM read_json_auto('{staging}')) "
                f"TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)"
            )
            staging.unlink()
            record_landed(release, out)
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )


def _sql_literal(value: str) -> str:
    """Quote a string for interpolation into SQL, doubling embedded apostrophes.

    DuckDB's table functions take their arguments positionally rather than as bound
    parameters, so a sheet name has to be interpolated. One of the three sheets this
    is used for is literally named `Director's Ratio History`, which terminates the
    string mid-name and produces a parser error at `s`.
    """
    return "'" + value.replace("'", "''") + "'"


def land_fixed_width(
    release: Release,
    adapter: type[SourceAdapter],
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Slice a fixed-width file into columns, unzipping it first if it is archived.

    The adapter owns the layout — `fixed_width_fields` gives (name, start, length) —
    exactly as it owns `to_records` for JSON. Landing stays dumb: it reads each record
    as one string and takes substrings at the offsets it is given, with no idea what
    any of them mean.

    Only the declared fields are sliced, and that is a privacy boundary rather than an
    optimisation. NJ's SR1A record devotes 178 of its 663 bytes to the names, street
    addresses and ZIP codes of both parties to every transaction, and no aggregate needs
    them. What the adapter does not declare never reaches Parquet.

    The record is read whole because DuckDB has no fixed-width reader: `read_csv` with a
    delimiter that cannot occur in the data yields one VARCHAR column per line, which is
    what `substr` then cuts up. `\\x1f` is the ASCII unit separator, which a file of
    printable fixed-width records does not contain.
    """
    fields = adapter.fixed_width_fields
    if not fields:
        raise ValueError(
            f"{adapter.__name__} lands fixed-width but declares no fixed_width_fields"
        )

    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            columns = ",\n                    ".join(
                f"trim(substr(line, {start}, {length})) AS {name}"
                for name, start, length in fields
            )
            with _unzipped(release.path) as source:
                con.execute(
                    f"""
                    COPY (
                        SELECT {columns}
                        FROM read_csv('{source}', columns={{'line': 'VARCHAR'}},
                                      delim='\x1f', header=false,
                                      quote='', escape='', encoding='latin-1')
                    ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
                    """
                )
            record_landed(release, out)
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )


@contextmanager
def _unzipped(path: Path) -> Iterator[Path]:
    """The file itself, or its single member extracted to a temporary directory.

    Extracted rather than streamed because DuckDB reads a path, and decompressed to
    disk rather than memory because one SR1A year is 113MB. The temporary copy is
    removed on the way out; `data/raw/` keeps the archive as published.
    """
    if not zipfile.is_zipfile(path):
        yield path
        return
    with zipfile.ZipFile(path) as archive:
        members = [m for m in archive.namelist() if not m.endswith("/")]
        if len(members) != 1:
            raise ValueError(f"{path.name}: expected one member, found {len(members)}")
        with tempfile.TemporaryDirectory(prefix="hip-land-") as tmp:
            yield Path(archive.extract(members[0], path=tmp))


def land_xlsx(
    release: Release,
    sheet: str,
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Transcode one worksheet to Parquet, every cell as text.

    `all_varchar=true` because these workbooks put four header rows above the data and
    a typed read would have to reconcile them with the values below; the staging model
    finds its own header row and casts there. Landing preserves the grid.

    `range` is not optional. Without it `read_xlsx` inferred a used-range that dropped
    the three identifier columns and all 567 data rows from NJ's effective-rate sheet,
    returning 3 rows by 29 columns and no error (measured 2026-09-19). An over-wide
    range is padded with nulls, which the staging model filters, so asking for more
    than exists is the safe direction to be wrong in.
    """
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            con.execute("INSTALL excel; LOAD excel;")
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_xlsx('{release.path}',
                                            sheet={_sql_literal(sheet)},
                                            range='{XLSX_RANGE}',
                                            header=false, all_varchar=true)
                ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            )
            record_landed(release, out)
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )
