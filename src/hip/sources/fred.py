"""Federal Reserve Economic Data — national macro series.

Only `MORTGAGE30US` today: the 30-year fixed mortgage rate, which is national and has no
regional breakdown. It lands at the `nation` level against a synthetic US region
(ARCHITECTURE #30) rather than being attached to New Jersey, because recording a
national rate as a state measurement is the kind of quiet inaccuracy this platform
exists to refuse.
"""

from __future__ import annotations

import os
from typing import ClassVar

from hip.config import ConfigError
from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# series id -> metric_id.
SERIES: dict[str, str] = {"MORTGAGE30US": "mortgage_rate_30y"}


class FredAdapter(SourceAdapter):
    """National macro series, monthly."""

    source_id: ClassVar[str] = "fred"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = os.environ.get("FRED_API_KEY")
        if not key:
            raise ConfigError(
                "fred requires FRED_API_KEY — there is no anonymous access at all "
                "(HTTP 400). Free at https://fredaccount.stlouisfed.org/apikeys"
            )
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=series_id,
                vintage=vintage or self.default_vintage,
                url=(
                    f"{BASE_URL}?series_id={series_id}&file_type=json"
                    f"&frequency=m&api_key={key}"
                ),
            )
            for series_id in SERIES
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        if not isinstance(payload, dict) or "observations" not in payload:
            raise ValueError(f"fred/{ref.key}: no 'observations' key in response")
        rows = payload["observations"]
        assert isinstance(rows, list)
        # FRED writes "." for a missing period rather than null.
        return [
            {"series_id": ref.layer, "date": r["date"], "value": r["value"]}
            for r in rows
            if isinstance(r, dict) and r.get("value") not in (".", None, "")
        ]
