"""What each figure is and what its source lets the site do with it (Milestone 31).

Every metric declares its kind (SPEC principle 11) and every source a licence class, and
a calculated metric inherits the most restrictive class of the metrics it is computed
from. These pin the rules against the real config, so a new source or metric cannot be
added without them, and a ratio cannot quietly lose the restriction of its input.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from hip.analytics.compute import RATIOS
from hip.config import (
    LICENCE_ORDER,
    Metric,
    Source,
    check_config,
    load_metrics,
    load_sources,
    metric_licence,
)


def test_the_real_config_has_no_licence_problems() -> None:
    problems = [p for p in check_config() if "is not set (see .env.example)" not in p]
    assert problems == []


def test_every_calculated_metric_declares_the_inputs_it_is_computed_from() -> None:
    """The config's inputs are what the licence is inherited from, so they must be the
    ones `hip analyze` actually divides."""
    metrics = load_metrics()
    declared = {
        metric_id: sorted(metric.inputs)
        for metric_id, metric in metrics.items()
        if metric.inputs
    }
    computed = {metric_id: sorted([a, b]) for metric_id, a, b, _ in RATIOS}
    assert declared == computed


def test_a_ratio_inherits_the_most_restrictive_licence_of_its_inputs() -> None:
    metrics, sources = load_metrics(), load_sources()
    assert metric_licence("price_to_income", metrics, sources) == "non_commercial"
    assert metric_licence("price_to_ami", metrics, sources) == "non_commercial"
    assert metric_licence("fmr_to_income", metrics, sources) == "public_domain"


def test_the_mortgage_rate_is_display_only_and_credits_its_owner() -> None:
    """FRED serves Freddie Mac's series; Freddie Mac's terms forbid redistribution."""
    metrics, sources = load_metrics(), load_sources()
    assert metric_licence("mortgage_rate_30y_weekly", metrics, sources) == "display_only"
    assert metrics["mortgage_rate_30y_weekly"].originator == "Freddie Mac"


def test_hud_determinations_are_not_survey_estimates() -> None:
    """SPEC v1.4: an agency's determination is labelled as one, not given a margin."""
    metrics = load_metrics()
    for metric_id in ("hud_area_median_income", "hud_income_limit_80", "hud_fmr_2br"):
        assert metrics[metric_id].record_type == "determination"
    assert metrics["chas_renter_cost_burden"].record_type == "survey"


def test_every_api_whose_terms_require_a_notice_carries_it() -> None:
    sources = load_sources()
    for source_id in ("census_acs", "hud", "hud_fmr", "hud_chas", "fred"):
        assert any("not endorsed or certified" in n for n in sources[source_id].notices)


def _source(**fields: Any) -> Source:
    base: dict[str, Any] = {
        "name": "s",
        "publisher": "p",
        "license": "l",
        "url": "https://x",
        "cadence": "annual",
        "adapter": "none",
        "fallback": "f",
        "licence_class": "public_domain",
        "terms_url": "https://x/terms",
        "terms_checked": date(2026, 9, 30),
    }
    return Source(**{**base, **fields})


def _metric(source_id: str, **fields: Any) -> Metric:
    base: dict[str, Any] = {
        "label": "m",
        "unit": "ratio",
        "frequency": "annual",
        "direction": "neutral",
        "description": "d",
        "source_id": source_id,
        "record_type": "calculated",
    }
    return Metric(**{**base, **fields})


@pytest.mark.parametrize("restricted", LICENCE_ORDER)
def test_inheritance_takes_the_most_restrictive_input(restricted: str) -> None:
    sources = {
        "open": _source(),
        "other": _source(licence_class=restricted),
        "mine": _source(licence_class="derived"),
    }
    metrics = {
        "a": _metric("open", record_type="survey"),
        "b": _metric("other", record_type="modelled"),
        "ratio": _metric("mine", inputs=["a", "b"]),
    }
    assert metric_licence("ratio", metrics, sources) == restricted
