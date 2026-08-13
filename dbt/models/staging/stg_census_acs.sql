-- ACS 5-year estimates, long form. County and county-subdivision GEOIDs are exact, so
-- this is the only municipal source that needs no name matching (ARCHITECTURE #31).
{{ config(materialized='table') }}

with raw as (
    select *, 'county' as lvl,
           regexp_extract(filename, '/(\d{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/county_*.parquet',
                      filename=true, union_by_name=true)
    union all by name
    select *, 'municipality' as lvl,
           regexp_extract(filename, '/(\d{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/cousub_*.parquet',
                      filename=true, union_by_name=true)
),
keyed as (
    select
        case when lvl = 'county' then state || county
             else state || county || "county subdivision" end as geoid,
        lvl as level,
        vintage::int as vintage,
        -- ACS marks a suppressed or unavailable estimate with -666666666, which is a
        -- plausible-looking number that must never reach the warehouse.
        nullif(nullif("B19013_001E", '-666666666'), '')::double as median_hh_income,
        nullif(nullif("B25064_001E", '-666666666'), '')::double as median_gross_rent,
        nullif(nullif("B01003_001E", '-666666666'), '')::double as population,
        nullif(nullif("B25077_001E", '-666666666'), '')::double as median_home_value,
        nullif(nullif("B25070_001E", '-666666666'), '')::double as renters_total,
        nullif(nullif("B25070_007E", '-666666666'), '')::double as b30,
        nullif(nullif("B25070_008E", '-666666666'), '')::double as b35,
        nullif(nullif("B25070_009E", '-666666666'), '')::double as b40,
        nullif(nullif("B25070_010E", '-666666666'), '')::double as b50
    from raw
    -- "County subdivisions not defined" carries subdivision code 00000, exactly as in
    -- TIGER. Same filter, same reason.
    where lvl = 'county' or "county subdivision" <> '00000'
),
unpivoted as (
    select geoid, level, vintage, 'acs_median_hh_income' as metric_id,
           median_hh_income as value from keyed
    union all select geoid, level, vintage, 'acs_median_gross_rent', median_gross_rent from keyed
    union all select geoid, level, vintage, 'acs_population', population from keyed
    union all select geoid, level, vintage, 'acs_median_home_value', median_home_value from keyed
    union all select geoid, level, vintage, 'acs_renter_cost_burden',
           case when renters_total > 0
                then (b30 + b35 + b40 + b50) / renters_total end
           from keyed
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
    'fips' as match_method,
    -- The ACS vintage is also the Parquet directory, so this is the release.
    vintage::varchar as release_vintage
from unpivoted
where value is not null
