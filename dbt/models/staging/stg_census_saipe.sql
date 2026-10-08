-- Census SAIPE median household income, one model-based estimate a year from 1989
-- (Milestone 52, ARCHITECTURE #348).
--
-- SAIPE publishes a 90% confidence interval rather than a margin; the margin here is
-- half its width, the same 90% level as the ACS margins beside it. 1990-1992 and 1994
-- are not published, nor 1996 for counties; a missing year is absent, never filled.
{{ config(materialized='table') }}

with estimates as (
    select *, 'county' as level, 'county' as release_layer
    from read_parquet('{{ var("parquet_dir") }}/census_saipe/current/county_*.parquet')
    union all
    select *, 'state', 'state'
    from read_parquet('{{ var("parquet_dir") }}/census_saipe/current/state_*.parquet')
)
select
    'census_saipe' as source_id,
    'saipe_median_hh_income' as metric_id,
    geoid,
    level,
    make_date(year::int, 1, 1) as period_start,
    make_date(year::int, 12, 31) as period_end,
    median_hh_income::double as value,
    (upper_90 - lower_90) / 2.0 as margin_of_error,
    'fips' as match_method,
    release_layer,
    'current' as release_vintage
from estimates
where substr(geoid, 1, 2) in ({{ var("state_fips") }})
