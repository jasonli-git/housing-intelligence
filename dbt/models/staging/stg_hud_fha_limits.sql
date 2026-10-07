-- FHA's loan limit for a one-unit home, per New Jersey county, by calendar year
-- (Milestone 48, ARCHITECTURE #326). One record per county in HUD's file.
{{ config(materialized='table') }}

select 'hud_fha_limits' as source_id, 'hud_fha_limit_1unit' as metric_id,
       '34' || county_fips as geoid, 'county' as level,
       make_date(vintage::integer, 1, 1) as period_start,
       make_date(vintage::integer, 12, 31) as period_end,
       limit_1_unit::double as value, 'fips' as match_method, 'forward' as release_layer,
       vintage as release_vintage
from (
    select *, regexp_extract(filename, '/hud_fha_limits/(\d{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/hud_fha_limits/*/forward.parquet',
                      filename = true)
)
where state = 'NJ' and trim(county_fips) <> ''
