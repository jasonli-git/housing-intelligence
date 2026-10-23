-- How long a listing sits, monthly, for New Jersey and each county (the visual stories,
-- 2026-10-23): Realtor.com's median days on market, which FRED republishes. FRED's
-- `dom_<geoid>` layers, one series each (`hip.sources.fred`); Realtor.com changed its
-- method in December 2021 and October 2022 and restated the history each time, so the
-- series as fetched is consistent with itself.
{{ config(materialized='table') }}

select 'fred' as source_id, 'realtor_median_days_on_market' as metric_id,
       substr(series_id, 5) as geoid,
       case when length(series_id) = 6 then 'state' else 'county' end as level,
       date as period_start, last_day(date) as period_end,
       try_cast(value as double) as value, 'fips' as match_method,
       series_id as release_layer, 'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
where series_id like 'dom_34%' and try_cast(value as double) is not null
