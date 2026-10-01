-- ACS occupancy and tenure (Milestone 21): vacancy rate from B25002 and homeownership
-- rate from B25003, at county, municipality and, since Milestone 34, ZCTA. Read from the
-- `housing_*` layers the adapter requests separately, so these rows cite their own
-- release; the income and rent tables stay in stg_census_acs, untouched.
{{ config(materialized='table') }}

with raw as (
    {{ acs_layers('housing_') }}
),
keyed as (
    select
        geoid,
        level,
        release_layer,
        vintage,
        -- The same suppression sentinel stg_census_acs refuses.
        nullif(nullif("B25002_001E", '-666666666'), '')::double as housing_units,
        nullif(nullif("B25002_003E", '-666666666'), '')::double as vacant_units,
        nullif(nullif("B25003_001E", '-666666666'), '')::double as occupied_units,
        nullif(nullif("B25003_002E", '-666666666'), '')::double as owner_occupied,
        -- Margins of error (Milestone 28), as stg_census_acs reads them.
        {{ acs_margin('"B25002_001M"') }} as housing_units_moe,
        {{ acs_margin('"B25002_003M"') }} as vacant_units_moe,
        {{ acs_margin('"B25003_001M"') }} as occupied_units_moe,
        {{ acs_margin('"B25003_002M"') }} as owner_occupied_moe
    from raw
),
unpivoted as (
    -- Vacancy counts every unit, seasonal and for-sale included — the Census definition,
    -- which a shore town's summer homes move a long way.
    select geoid, level, release_layer, vintage, 'acs_vacancy_rate' as metric_id,
           case when housing_units > 0 then vacant_units / housing_units end as value,
           {{ acs_share_margin('vacant_units', 'housing_units',
                               'vacant_units_moe', 'housing_units_moe') }}
               as margin_of_error
    from keyed
    union all
    select geoid, level, release_layer, vintage, 'acs_homeownership_rate',
           case when occupied_units > 0 then owner_occupied / occupied_units end,
           {{ acs_share_margin('owner_occupied', 'occupied_units',
                               'owner_occupied_moe', 'occupied_units_moe') }}
    from keyed
)
select
    'census_acs' as source_id,
    metric_id,
    geoid,
    level,
    make_date(vintage - 4, 1, 1) as period_start,
    make_date(vintage, 12, 31)   as period_end,
    value,
    margin_of_error,
    case when level = 'zip' then 'zcta' else 'fips' end as match_method,
    release_layer,
    vintage::varchar as release_vintage
from unpivoted
where value is not null
