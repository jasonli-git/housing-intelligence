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

# The ratios `hip analyze` divides by an ACS estimate, which carry its margin
# (ARCHITECTURE #238): household income, and since Milestone 39 the housing-unit count
# net additions are measured against. `hip_derived` alone cannot say which derived
# metrics these are, so they are named.
ON_SURVEY_INCOME = frozenset(
    {"fmr_to_income", "price_to_income", "rent_to_income", "nj_net_units_per_1000"}
)

SURVEY_METRICS = frozenset(
    {
        "acs_housing_units",
        "acs_median_rent_studio",
        "acs_median_rent_1br",
        "acs_median_rent_2br",
        "acs_median_rent_3br",
        "acs_median_rent_4br",
        "acs_rent_lower_quartile",
        "acs_rent_upper_quartile",
        "acs_owner_costs_mortgage",
        "acs_owner_costs_no_mortgage",
        "acs_renter_severe_burden",
        "acs_owner_severe_burden",
        "acs_share_detached",
        "acs_share_attached",
        "acs_share_2_4_units",
        "acs_share_5_19_units",
        "acs_share_20plus_units",
        "acs_share_mobile_homes",
        "acs_median_year_built",
        "acs_share_built_2000_later",
        "acs_share_built_1980_1999",
        "acs_share_built_1940_1979",
        "acs_share_built_pre_1940",
        "acs_share_0_1_bedrooms",
        "acs_share_2_bedrooms",
        "acs_share_3_bedrooms",
        "acs_share_4plus_bedrooms",
        "acs_overcrowded_share",
        "acs_lacking_plumbing_share",
        "acs_lacking_kitchen_share",
        "acs_avg_household_size",
        "acs_no_vehicle_share",
        "acs_rental_vacancy_rate",
        "acs_homeowner_vacancy_rate",
        "acs_vacant_seasonal_share",
        "acs_vacant_other_share",
        "acs_heat_gas_share",
        "acs_heat_electric_share",
        "acs_heat_oil_share",
        "acs_heat_propane_share",
        "acs_heat_other_share",
        "acs_commute_transit_share",
        "acs_work_from_home_share",
        "acs_commute_drove_alone_share",
        "acs_commute_walked_share",
        "acs_mean_commute_minutes",
        "acs_commute_60plus_share",
        "acs_living_alone_share",
        "acs_married_couple_share",
        "acs_with_children_share",
        "acs_disability_share",
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
