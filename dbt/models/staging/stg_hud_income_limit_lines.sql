-- HUD's income limits in full, per county and fiscal year (Milestone 35): the 30%, 50%
-- and 80% lines for households of one to eight. Not a metric model — 24 numbers a
-- county-year would be 24 metrics nobody ranks — so it feeds `income_limits`, which the
-- income check reads for a reader's household size (ARCHITECTURE #285).
{{ config(materialized='table') }}

with raw as (
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud/*/il_*.parquet', union_by_name=true
    )
),
lines as (
    {%- for band in [30, 50, 80] %}
    {%- for size in range(1, 9) %}
    select county_fips, year::int as fiscal_year, {{ band }} as band, {{ size }} as household_size,
           il{{ band }}_p{{ size }}::double as income_limit,
           median_income::double as median_income
    from raw
    {%- if not loop.last %} union all {% endif %}
    {%- endfor %}
    {%- if not loop.last %} union all {% endif %}
    {%- endfor %}
)
select
    'hud' as source_id,
    county_fips as geoid,
    fiscal_year,
    band,
    household_size,
    income_limit,
    median_income,
    'il_' || county_fips as release_layer,
    fiscal_year::varchar as release_vintage
from lines
where income_limit is not null
  and left(county_fips, 2) in ({{ var("state_fips") }})
