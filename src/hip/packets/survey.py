"""Which metrics are survey figures, and so carry a margin of error (SPEC principle 12).

A figure estimated from a sample survey — the Census's American Community Survey, and
HUD's CHAS tables, which HUD builds from ACS microdata — is an estimate with a known
sampling error, and so is a ratio the platform divides by one. Such a figure shows its
margin wherever it is read, and one without a margin says so rather than reading as
exact. That last case is why this list exists at all: a null margin on its own cannot
tell "no margin available" from "not a survey figure".

A constant rather than a warehouse column or a config lookup, because the API assembles
packets per request and must not read YAML to do it. `tests/test_survey_metrics.py`
holds it to `config/metrics.yml` — every metric sourced from the ACS or CHAS is here —
and holds the dashboard's own list, `SURVEY_METRICS` in `web/lib/uncertainty.ts`, to it.
"""

from __future__ import annotations

# The ratios `hip analyze` divides by ACS household income, which carry that income's
# margin (ARCHITECTURE #238). `hip_derived` alone cannot say which derived metrics these
# are, so they are named.
ON_SURVEY_INCOME = frozenset({"fmr_to_income", "price_to_income", "rent_to_income"})

SURVEY_METRICS = frozenset(
    {
        "acs_homeownership_rate",
        "acs_median_electricity",
        "acs_median_gas",
        "acs_median_gross_rent",
        "acs_median_hh_income",
        "acs_median_home_insurance",
        "acs_median_home_value",
        "acs_median_other_fuel",
        "acs_median_water_sewer",
        "acs_population",
        "acs_renter_cost_burden",
        "acs_renters_paying_utilities",
        "acs_vacancy_rate",
        "chas_owner_cost_burden",
        "chas_renter_cost_burden",
        "chas_renter_severe_burden",
    }
    | ON_SURVEY_INCOME
)


def is_survey(metric_id: str) -> bool:
    return metric_id in SURVEY_METRICS


__all__ = ["ON_SURVEY_INCOME", "SURVEY_METRICS", "is_survey"]
