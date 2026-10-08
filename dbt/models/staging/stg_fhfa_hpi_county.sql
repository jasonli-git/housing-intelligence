-- FHFA's annual all-transactions index by county (Milestone 52, ARCHITECTURE #348).
--
-- Base 100 in each county's first recorded year, so a level compares a county with its
-- own other years only. The workbook is national; landing keeps every county and this
-- model keeps the configured states'.
{{ config(materialized='table') }}

select
    'fhfa_hpi_county' as source_id,
    'fhfa_hpi_county' as metric_id,
    geoid,
    'county' as level,
    make_date(year::int, 1, 1) as period_start,
    make_date(year::int, 12, 31) as period_end,
    hpi::double as value,
    'fips' as match_method,
    'county' as release_layer,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fhfa_hpi_county/current/county.parquet')
where substr(geoid, 1, 2) in ({{ var("state_fips") }})
  and hpi is not null
