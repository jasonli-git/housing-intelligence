"""Federal Reserve Economic Data — national macro series.

Only `MORTGAGE30US` today: the 30-year fixed mortgage rate, which is national and has no
regional breakdown. It lands at the `nation` level against a synthetic US region
(ARCHITECTURE #30) rather than being attached to New Jersey, because recording a
national rate as a state measurement is the kind of quiet inaccuracy this platform
exists to refuse.

**Two frequencies of one series** (Milestone 26). Freddie Mac publishes the rate weekly;
the platform had only ever asked FRED for monthly averages. So on 2026-09-23 the cost card
priced a mortgage at August's 6.67% while Freddie Mac's benchmark for the week of
September 17 was 6.95% — two different windows, not two contradictory sources. The weekly
benchmark now prices today's card; the monthly averages stay for history, where "the rate
buyers faced in July 2021" is a month.
"""

from __future__ import annotations

import os
from typing import ClassVar

from hip.config import ConfigError
from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# release layer -> (FRED series id, the `frequency` to ask FRED for, or None for the
# series' own). The layer is the series id for the monthly average, which is what every
# release before Milestone 26 was recorded under, so its provenance continues unbroken.
SERIES: dict[str, tuple[str, str | None]] = {
    "MORTGAGE30US": ("MORTGAGE30US", "m"),
    "MORTGAGE30US_weekly": ("MORTGAGE30US", None),
}


class FredAdapter(SourceAdapter):
    """National macro series: the 30-year rate, weekly and as monthly averages."""

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
                layer=layer,
                vintage=vintage or self.default_vintage,
                url=(
                    f"{BASE_URL}?series_id={series_id}&file_type=json"
                    + (f"&frequency={frequency}" if frequency else "")
                    + f"&api_key={key}"
                ),
            )
            for layer, (series_id, frequency) in SERIES.items()
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
