-- FRED national macro series. Lands at the `nation` level against the synthetic US
-- region (ARCHITECTURE #30) rather than being attributed to a state.
{{ config(materialized='table') }}

select
    'fred' as source_id,
    'mortgage_rate_30y' as metric_id,
    'US' as geoid,
    'nation' as level,
    date as period_start,
    (date + interval 1 month - interval 1 day)::date as period_end,
    try_cast(value as double) as value,
    'national' as match_method,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
where series_id = 'MORTGAGE30US'
  and try_cast(value as double) is not null
