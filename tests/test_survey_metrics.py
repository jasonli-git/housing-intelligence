"""The page's list of survey metrics matches the config (SPEC principle 12).

A survey figure shows its margin of error, and one without says so rather than reading
as exact. The dashboard decides which figures are survey figures from `SURVEY_METRICS`
in `web/lib/uncertainty.ts`, a hand-written list — so this keeps it honest: a metric the
config sources from the ACS or HUD's CHAS tables that the list misses would render as
exact without anything failing.
"""

from __future__ import annotations

import re
from pathlib import Path

from hip.config import load_metrics

ROOT = Path(__file__).resolve().parents[1]
# The ratios divided by ACS income carry its margin; `hip_derived` alone cannot say
# which derived metrics those are, so they are named.
ON_SURVEY_INCOME = {"fmr_to_income", "price_to_income", "rent_to_income"}


def _survey_metrics_in_web() -> set[str]:
    source = (ROOT / "web" / "lib" / "uncertainty.ts").read_text(encoding="utf-8")
    block = re.search(r"SURVEY_METRICS = new Set\(\[(.*?)\]\)", source, re.S)
    assert block, "SURVEY_METRICS not found in web/lib/uncertainty.ts"
    return set(re.findall(r'"([a-z0-9_]+)"', block.group(1)))


def test_every_survey_metric_in_the_config_is_one_on_the_page() -> None:
    metrics = load_metrics()
    surveyed = {
        metric_id
        for metric_id, metric in metrics.items()
        if metric.source_id in {"census_acs", "hud_chas"}
    }
    assert set(metrics) >= ON_SURVEY_INCOME
    assert _survey_metrics_in_web() == surveyed | ON_SURVEY_INCOME
