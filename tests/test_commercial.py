"""What each source's terms allow for the two commercial uses the owner is weighing
(Milestone 32, ARCHITECTURE #277): ads on the free site, and a paid tier. Pinned against
the real config, so a source cannot be added without saying, and a ratio cannot lose the
restriction of the figure it is computed from."""

from __future__ import annotations

import shutil
from pathlib import Path

import yaml

from hip.config import (
    COMMERCIAL_USES,
    REPO_ROOT,
    check_config,
    load_metrics,
    load_sources,
    metric_commercial,
)


def test_every_source_but_the_platforms_own_states_its_commercial_rights() -> None:
    sources = load_sources()
    missing = [
        source_id
        for source_id, source in sources.items()
        if source.licence_class != "derived" and source.commercial is None
    ]
    assert missing == []
    assert sources["hip_derived"].commercial is None


def test_a_source_without_commercial_rights_is_a_config_problem(tmp_path: Path) -> None:
    for name in ("sources.yml", "metrics.yml", "geography.yml"):
        shutil.copy(REPO_ROOT / "config" / name, tmp_path / name)
    raw = yaml.safe_load((tmp_path / "sources.yml").read_text())
    del raw["sources"]["bls"]["commercial"]
    (tmp_path / "sources.yml").write_text(yaml.safe_dump(raw))
    problems = check_config(tmp_path)
    assert any("bls: commercial is not set" in p for p in problems)


def test_a_ratio_takes_the_least_permissive_right_of_its_inputs() -> None:
    """Price to income is Zillow's home value over the survey's income: no paid tier."""
    metrics, sources = load_metrics(), load_sources()
    assert metric_commercial("price_to_income", metrics, sources, "paid") == "not_allowed"
    assert metric_commercial("price_to_income", metrics, sources, "ads") == "unclear"
    assert metric_commercial("fmr_to_income", metrics, sources, "paid") == "allowed"


def test_what_survives_each_use_today() -> None:
    """Measured 2026-10-01: Zillow's two indexes, Freddie Mac's rate and the three ratios
    built on Zillow are the only figures not cleared for either use. Milestone 40 adds
    OpenFEMA's flood claims, whose terms do not address commercial use in words."""
    metrics, sources = load_metrics(), load_sources()
    restricted = {
        use: sorted(
            m for m in metrics if metric_commercial(m, metrics, sources, use) != "allowed"
        )
        for use in COMMERCIAL_USES
    }
    expected = sorted(
        [
            "zhvi_sfr",
            "zori_all",
            "mortgage_rate_30y",
            "mortgage_rate_30y_weekly",
            "price_to_income",
            "rent_to_income",
            "price_to_ami",
            "fema_flood_claims",
            "fema_flood_claims_paid",
            "fema_flood_claims_unplaced",
        ]
    )
    assert restricted == {"ads": expected, "paid": expected}
