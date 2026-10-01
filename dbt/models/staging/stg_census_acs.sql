-- ACS 5-year estimates, long form. County, county-subdivision and ZCTA codes are exact,
-- so no row needs name matching (ARCHITECTURE #31; ZCTAs since Milestone 34).
{{ config(materialized='table') }}

with raw as (
    {{ acs_layers('') }}
),
keyed as (
    select
        geoid,
        level,
        release_layer,
        vintage,
        -- ACS marks a suppressed or unavailable estimate with -666666666, which is a
        -- plausible-looking number that must never reach the warehouse.
        -- A median in an open-ended bracket is the bracket's bound ("$250,000 or more",
        -- "less than $100"), flagged by the margin code -333333333, and is no median:
        -- NULL since Milestone 34, which found 109 municipal figures printing a bound.
        case when "B19013_001M" = '-333333333' then null
             else nullif(nullif("B19013_001E", '-666666666'), '')::double
        end as median_hh_income,
        case when "B25064_001M" = '-333333333' then null
             else nullif(nullif("B25064_001E", '-666666666'), '')::double
        end as median_gross_rent,
        nullif(nullif("B01003_001E", '-666666666'), '')::double as population,
        case when "B25077_001M" = '-333333333' then null
             else nullif(nullif("B25077_001E", '-666666666'), '')::double
        end as median_home_value,
        nullif(nullif("B25070_001E", '-666666666'), '')::double as renters_total,
        nullif(nullif("B25070_007E", '-666666666'), '')::double as b30,
        nullif(nullif("B25070_008E", '-666666666'), '')::double as b35,
        nullif(nullif("B25070_009E", '-666666666'), '')::double as b40,
        nullif(nullif("B25070_010E", '-666666666'), '')::double as b50,
        -- Renters whose burden the Census could not compute: no or negative income, or
        -- no cash rent. Out of the denominator since Milestone 28 — they are neither
        -- burdened nor not — the universe HUD's CHAS tables use.
        nullif(nullif("B25070_011E", '-666666666'), '')::double as not_computed,
        -- Each estimate's 90% margin of error (Milestone 28), read through the macro
        -- that turns the Census's special codes into NULL rather than numbers.
        {{ acs_margin('"B19013_001M"') }} as median_hh_income_moe,
        {{ acs_margin('"B25064_001M"') }} as median_gross_rent_moe,
        {{ acs_margin('"B01003_001M"') }} as population_moe,
        {{ acs_margin('"B25077_001M"') }} as median_home_value_moe,
        {{ acs_margin('"B25070_001M"') }} as renters_total_moe,
        {{ acs_margin('"B25070_007M"') }} as b30_moe,
        {{ acs_margin('"B25070_008M"') }} as b35_moe,
        {{ acs_margin('"B25070_009M"') }} as b40_moe,
        {{ acs_margin('"B25070_010M"') }} as b50_moe,
        {{ acs_margin('"B25070_011M"') }} as not_computed_moe
    from raw
),
burden as (
    select *,
           b30 + b35 + b40 + b50 as burdened,
           {{ acs_sum_margin(['b30_moe', 'b35_moe', 'b40_moe', 'b50_moe']) }} as burdened_moe,
           renters_total - not_computed as computed,
           {{ acs_sum_margin(['renters_total_moe', 'not_computed_moe']) }} as computed_moe
    from keyed
),
unpivoted as (
    select geoid, level, release_layer, vintage, 'acs_median_hh_income' as metric_id,
           median_hh_income as value, median_hh_income_moe as margin_of_error from burden
    union all select geoid, level, release_layer, vintage, 'acs_median_gross_rent',
           median_gross_rent, median_gross_rent_moe from burden
    union all select geoid, level, release_layer, vintage, 'acs_population',
           population, population_moe from burden
    union all select geoid, level, release_layer, vintage, 'acs_median_home_value',
           median_home_value, median_home_value_moe from burden
    union all select geoid, level, release_layer, vintage, 'acs_renter_cost_burden',
           case when computed > 0 then burdened / computed end,
           {{ acs_share_margin('burdened', 'computed', 'burdened_moe', 'computed_moe') }}
           from burden
)
select
    'census_acs' as source_id,
    metric_id,
    geoid,
    level,
    -- A 5-year estimate covers the five years ending in its vintage.
    make_date(vintage - 4, 1, 1) as period_start,
    make_date(vintage, 12, 31)   as period_end,
    value,
    margin_of_error,
    case when level = 'zip' then 'zcta' else 'fips' end as match_method,
    -- ACS ships one file per (level, year) and names the municipal level 'cousub';
    -- the layer is the file's, from `acs_layers`. Naming the region level here once
    -- cited the county file for every municipal row.
    release_layer,
    -- The ACS vintage is also the Parquet directory, so this is the release.
    vintage::varchar as release_vintage
from unpivoted
where value is not null
