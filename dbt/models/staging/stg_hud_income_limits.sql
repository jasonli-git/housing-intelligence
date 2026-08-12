-- HUD area median income and the 80% AMI threshold, per county per year.
{{ config(materialized='table') }}

with raw as (
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud/*/il_*.parquet', union_by_name=true
    )
),
unpivoted as (
    select county_fips, year, 'hud_area_median_income' as metric_id,
           median_income as value from raw
    union all
    select county_fips, year, 'hud_income_limit_80', income_limit_80 from raw
)
select
    'hud' as source_id,
    metric_id,
    county_fips as geoid,
    'county' as level,
    make_date(year::int, 1, 1)  as period_start,
    make_date(year::int, 12, 31) as period_end,
    value::double as value,
    'fips' as match_method
from unpivoted
where value is not null
