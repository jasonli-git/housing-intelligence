"""Exercise build aggregation against duplicate synthetic records."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import duckdb

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as temp:
    data = Path(temp)
    parcel = data / "parquet/nj_modiv/current"
    sale = data / "parquet/nj_sr1a/2025"
    parcel.mkdir(parents=True)
    sale.mkdir(parents=True)
    with duckdb.connect() as con:
        con.execute(
            """COPY (SELECT * FROM (VALUES ('A'),('A'),('B'),(''),(NULL))
            t(PAMS_PIN)) TO ? (FORMAT PARQUET)""",
            [str(parcel / "statewide.parquet")],
        )
        con.execute(
            """COPY (SELECT * FROM (VALUES ('01','01','1','25'),
            ('01','01','1','25'),('01','02','1','25'))
            t(county_code,district_code,serial_number,assess_year))
            TO ? (FORMAT PARQUET)""",
            [str(sale / "sales.parquet")],
        )
    artifact = root / "web/.property-scale.json"
    original = artifact.read_bytes() if artifact.exists() else None
    try:
        subprocess.run(
            [sys.executable, str(root / "web/scripts/count-property-records.py")],
            env={**os.environ, "HIP_DATA_DIR": temp},
            check=True,
        )
        result = json.loads(artifact.read_text())
        assert result == {"parcels": 2, "transactions": 2, "archives": ["2025"]}, result
        subprocess.run(
            [sys.executable, str(root / "web/scripts/count-property-records.py")],
            env={**os.environ, "HIP_DATA_DIR": str(data / "missing")},
            check=True,
        )
        assert not artifact.exists(), "Missing landed data retained stale totals"
        print(
            "Deduplication, missing identifiers, archive labels "
            "and stale-count omission passed."
        )
    finally:
        if original is not None:
            artifact.write_bytes(original)
        else:
            artifact.unlink(missing_ok=True)
