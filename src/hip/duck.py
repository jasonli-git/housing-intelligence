"""DuckDB session helper.

An infrastructure leaf like ``hip.config``: importable from anywhere, holds no pipeline
logic (ARCHITECTURE #23). It lives here rather than in ``hip.transform`` because
``hip.landing`` needs DuckDB to read shapefiles, and landing importing transform would
run backward along the pipeline.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import duckdb


@contextmanager
def duckdb_session(
    path: Path | None = None, *, spatial: bool = False
) -> Iterator[duckdb.DuckDBPyConnection]:
    """Open DuckDB, optionally with the spatial extension loaded.

    ``path=None`` opens an in-memory database, which is what transient work (reading a
    shapefile, computing an intersection) wants — the persistent file is for staged
    tables that later stages read.
    """
    target = ":memory:" if path is None else str(path)
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(target)
    try:
        if spatial:
            # INSTALL is a no-op once the extension is in the local cache; the first
            # call on a clean machine needs network access.
            con.execute("INSTALL spatial")
            con.execute("LOAD spatial")
        yield con
    finally:
        con.close()


def vsizip(archive: Path, member: str) -> str:
    """GDAL virtual path for a file inside a zip, for use with ``ST_Read``.

    Avoids unzipping 500MB of shapefile to disk just to read it once.
    """
    return f"/vsizip/{archive}/{member}"
