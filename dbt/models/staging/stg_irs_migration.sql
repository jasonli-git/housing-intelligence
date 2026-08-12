-- IRS SOI migration, reduced to net returns per county.
--
-- The source is origin→destination pairs. Row `y1_statefips = 96, y1_countyfips = 0` is
-- the publisher's own "Total Migration-US and Foreign" aggregate, which is what net is
-- computed from — summing the pair rows would double-count the aggregates mixed in.
-- The full pair matrix stays in Parquet for post-V1 migration-demand work.
{{ config(materialized='table') }}

with flows as (
    select 'in' as direction,
           lpad(y2_statefips::varchar, 2, '0') || lpad(y2_countyfips::varchar, 3, '0') as geoid,
           regexp_extract(filename, '/(\d{4})/', 1) as pair, n1
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/inflow.parquet', filename=true)
    where y1_statefips = 96 and y1_countyfips = 0
    union all
    select 'out',
           lpad(y1_statefips::varchar, 2, '0') || lpad(y1_countyfips::varchar, 3, '0'),
           regexp_extract(filename, '/(\d{4})/', 1), n1
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/outflow.parquet', filename=true)
    where y2_statefips = 96 and y2_countyfips = 0
),
net as (
    select geoid, pair,
           sum(case when direction = 'in' then n1 else -n1 end) as net_returns
    from flows
    where substr(geoid, 1, 2) in ({{ var("state_fips") }})
    group by 1, 2
)
select
    'irs_migration' as source_id,
    'net_migration_returns' as metric_id,
    geoid,
    'county' as level,
    -- Pair '2122' compares tax years 2021 and 2022; the moves land in 2022.
    make_date(2000 + substr(pair, 3, 2)::int, 1, 1) as period_start,
    make_date(2000 + substr(pair, 3, 2)::int, 12, 31) as period_end,
    net_returns::double as value,
    'fips' as match_method
from net
