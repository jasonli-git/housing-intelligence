-- ACS occupancy and tenure (Milestone 21): vacancy rate from B25002 and homeownership
-- rate from B25003, at county and municipality. Read from the `housing_*` layers the
-- adapter requests separately, so these rows cite their own release; the income and
-- rent tables stay in stg_census_acs, untouched.
{{ config(materialized='table') }}

with raw as (
    select *, 'county' as lvl, 'housing_county' as release_layer,
           regexp_extract(filename, '/(\d{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/housing_county_*.parquet',
                      filename=true, union_by_name=true)
    union all by name
    select *, 'municipality' as lvl, 'housing_cousub' as release_layer,
           regexp_extract(filename, '/(\d{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/housing_cousub_*.parquet',
                      filename=true, union_by_name=true)
),
keyed as (
    select
        case when lvl = 'county' then state || county
             else state || county || "county subdivision" end as geoid,
        lvl as level,
        release_layer,
        vintage::int as vintage,
        -- The same suppression sentinel stg_census_acs refuses.
        nullif(nullif("B25002_001E", '-666666666'), '')::double as housing_units,
        nullif(nullif("B25002_003E", '-666666666'), '')::double as vacant_units,
        nullif(nullif("B25003_001E", '-666666666'), '')::double as occupied_units,
        nullif(nullif("B25003_002E", '-666666666'), '')::double as owner_occupied
    from raw
    where lvl = 'county' or "county subdivision" <> '00000'
),
unpivoted as (
    -- Vacancy counts every unit, seasonal and for-sale included — the Census definition,
    -- which a shore town's summer homes move a long way.
    select geoid, level, release_layer, vintage, 'acs_vacancy_rate' as metric_id,
           case when housing_units > 0 then vacant_units / housing_units end as value
    from keyed
    union all
    select geoid, level, release_layer, vintage, 'acs_homeownership_rate',
           case when occupied_units > 0 then owner_occupied / occupied_units end
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
    'fips' as match_method,
    release_layer,
    vintage::varchar as release_vintage
from unpivoted
where value is not null
