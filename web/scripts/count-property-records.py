"""Build-only aggregate counts. Never exports addresses, owners or transaction rows."""

import json
import os
from pathlib import Path

import duckdb

root = Path(__file__).resolve().parents[2]
data = Path(os.environ.get("HIP_DATA_DIR", root / "data"))
output = root / "web/.property-scale.json"
# Remove stale totals before querying; missing data must not preserve an old brag.
output.unlink(missing_ok=True)
parcels = data / "parquet/nj_modiv/current/statewide.parquet"
sales = sorted((data / "parquet/nj_sr1a").glob("*/sales.parquet"))
if not parcels.exists() or not sales:
    print("Property scale omitted: landed MOD-IV/SR1A data unavailable.")
else:
    with duckdb.connect() as con:
        parcel_count = con.execute(
            "SELECT count(DISTINCT nullif(trim(PAMS_PIN), '')) FROM read_parquet(?)",
            [str(parcels)],
        ).fetchone()[0]
        # Serial numbers repeat across districts/ratio years. Composite key prevents
        # refreshed/overlapping records from inflating the headline.
        sale_count, invalid = con.execute(
            """SELECT count(DISTINCT
              (county_code,district_code,serial_number,assess_year)),
            count(*) FILTER (WHERE county_code IS NULL OR district_code IS NULL
              OR serial_number IS NULL OR assess_year IS NULL)
            FROM read_parquet(?)""",
            [list(map(str, sales))],
        ).fetchone()
        if invalid:
            raise ValueError("SR1A records missing deduplication keys")
    output.write_text(
        json.dumps(
            {
                "parcels": parcel_count,
                "transactions": sale_count,
                "archives": [p.parent.name for p in sales],
            }
        )
        + "\n"
    )
    print(
        f"Property scale: {parcel_count:,} parcel identifiers; "
        f"{sale_count:,} SR1A records."
    )
