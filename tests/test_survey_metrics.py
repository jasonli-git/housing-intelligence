"""The lists of survey metrics match the config (SPEC principle 12).

A survey figure shows its margin of error, and one without says so rather than reading
as exact. Two hand-written lists decide which figures are survey figures: the packets'
`SURVEY_METRICS` in `hip/packets/survey.py`, which marks them for reports and readings
(Milestone 30), and the dashboard's in `web/lib/uncertainty.ts`. This keeps both honest:
a metric the config sources from the ACS or HUD's CHAS tables that a list misses would
read as exact without anything failing.
"""

from __future__ import annotations

import re
from pathlib import Path

from hip.config import load_metrics
from hip.packets.survey import ON_SURVEY_INCOME, SURVEY_METRICS

ROOT = Path(__file__).resolve().parents[1]


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
    assert surveyed | ON_SURVEY_INCOME == SURVEY_METRICS


def test_the_page_and_the_packets_agree_on_which_figures_are_survey_figures() -> None:
    assert _survey_metrics_in_web() == SURVEY_METRICS
