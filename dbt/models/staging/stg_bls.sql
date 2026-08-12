-- BLS Local Area Unemployment Statistics, county monthly.
{{ config(materialized='table') }}

select
    'bls' as source_id,
    'unemployment_rate' as metric_id,
    county_fips as geoid,
    'county' as level,
    make_date(year::int, substr(period, 2, 2)::int, 1) as period_start,
    (make_date(year::int, substr(period, 2, 2)::int, 1)
        + interval 1 month - interval 1 day)::date as period_end,
    try_cast(value as double) as value,
    'fips' as match_method
from read_parquet('{{ var("parquet_dir") }}/bls/current/*.parquet')
-- BLS writes '-' for a suppressed month, which is an absence, not a zero.
where try_cast(value as double) is not null
