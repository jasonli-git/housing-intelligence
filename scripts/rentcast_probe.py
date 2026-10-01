"""RentCast's market statistics for a sample of New Jersey ZIP codes, set beside Zillow's
(Milestone 32, `reports/commercial/viability.md`, section 5).

A study, not an adapter: it answers whether RentCast's figures are usable, now that its
terms are known to allow republishing them. It spends at most `BUDGET` of the free
plan's 50 monthly requests, counting every request it has ever made in
`data/rentcast/spent.json`, so a rerun cannot overspend. The free plan takes no card,
and nothing here subscribes to anything.

    RENTCAST_API_KEY=... uv run python scripts/rentcast_probe.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime

import httpx
from sqlalchemy import text

from hip.config import get_settings, load_env_file
from hip.warehouse.db import get_engine

BUDGET = 20
ENDPOINT = "https://api.rentcast.io/v1/markets"

# Ten ZIP codes across the state's markets: the dense north, the shore, Princeton, the
# cities, the rural north-west and the cheapest county.
SAMPLE = {
    "07030": "Hoboken",
    "07601": "Hackensack",
    "07960": "Morristown",
    "07102": "Newark",
    "08540": "Princeton",
    "08618": "Trenton",
    "08701": "Lakewood",
    "08043": "Voorhees",
    "07860": "Newton",
    "08302": "Bridgeton",
}


def _zillow(geoid: str) -> dict[str, float | str | None]:
    """Zillow's latest home value and rent for a ZIP code, as the warehouse holds them."""
    query = text(
        """
        select f.metric_id, f.value, f.period_end
        from fact_metric_observation f join regions r using (region_id)
        where r.level = 'zip' and r.geoid = :geoid
          and f.metric_id in ('zhvi_sfr', 'zori_all')
        order by f.period_end desc
        """
    )
    found: dict[str, float | str | None] = {}
    with get_engine().connect() as conn:
        for metric_id, value, period_end in conn.execute(query, {"geoid": geoid}):
            found.setdefault(metric_id, value)
            found.setdefault(f"{metric_id}_period", str(period_end))
    return found


def main() -> int:
    load_env_file()
    key = os.environ.get("RENTCAST_API_KEY")
    if not key:
        print("RENTCAST_API_KEY is not set; nothing was requested", file=sys.stderr)
        return 1
    out = get_settings().data_dir / "rentcast"
    out.mkdir(parents=True, exist_ok=True)
    ledger = out / "spent.json"
    spent = json.loads(ledger.read_text())["requests"] if ledger.exists() else 0

    rows = []
    for zip_code, place in SAMPLE.items():
        if spent >= BUDGET:
            print(f"budget of {BUDGET} requests reached; stopping", file=sys.stderr)
            break
        response = httpx.get(
            ENDPOINT,
            params={"zipCode": zip_code, "dataType": "All", "historyRange": 1},
            headers={"X-Api-Key": key, "Accept": "application/json"},
            timeout=30,
        )
        spent += 1
        ledger.write_text(
            json.dumps({"requests": spent, "at": datetime.now(UTC).isoformat()})
        )
        (out / f"{zip_code}.json").write_text(response.text)
        if response.status_code != 200:
            print(
                f"{zip_code} {place}: HTTP {response.status_code} {response.text[:200]}"
            )
            continue
        data = response.json()
        sale = data.get("saleData") or {}
        rental = data.get("rentalData") or {}
        zillow = _zillow(zip_code)
        rows.append(
            {
                "zip": zip_code,
                "place": place,
                "rentcast_median_price": sale.get("medianPrice"),
                "rentcast_listings": sale.get("totalListings"),
                "rentcast_median_rent": rental.get("medianRent"),
                "rentcast_rentals": rental.get("totalListings"),
                "rentcast_updated": sale.get("lastUpdatedDate"),
                **{f"zillow_{k}": v for k, v in zillow.items()},
            }
        )
    (out / "comparison.json").write_text(json.dumps(rows, indent=2, default=str))
    print(json.dumps(rows, indent=2, default=str))
    print(f"{spent} of {BUDGET} budgeted requests spent in total", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
