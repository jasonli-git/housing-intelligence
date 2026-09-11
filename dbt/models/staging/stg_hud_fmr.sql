-- HUD Fair Market Rents, two-bedroom, per county per fiscal year (Milestone 21).
--
-- Dated as the fiscal year it is: FY2026 took effect on 2025-10-01 and runs to
-- 2026-09-30. Income limits are dated as calendar years (stg_hud_income_limits), which
-- is a quarter out for FMRs and would have put FY2026 against income data a year newer
-- than it was set from.
--
-- Two bedrooms because that is the unit HUD's own affordability reporting and every
-- housing-wage calculation quote; the other four sizes are landed and not staged.
-- Whole counties only: the ten-digit code ends in 99999 for a county, and in a town
-- code for New England's town-based FMR areas.
{{ config(materialized='table') }}

select
    'hud_fmr' as source_id,
    'hud_fmr_2br' as metric_id,
    left(fips_code, 5) as geoid,
    'county' as level,
    make_date(fiscal_year::int - 1, 10, 1) as period_start,
    make_date(fiscal_year::int, 9, 30) as period_end,
    two_bedroom::double as value,
    'fips' as match_method,
    'fmr' as release_layer,
    {{ release_vintage() }} as release_vintage
from read_parquet('{{ var("parquet_dir") }}/hud_fmr/*/fmr_*.parquet', filename=true)
where right(fips_code, 5) = '99999'
  and left(fips_code, 2) in ({{ var("state_fips") }})
  and two_bedroom is not null
