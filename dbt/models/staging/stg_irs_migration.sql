-- IRS SOI migration: each county's moves in, out and staying, per year pair
-- (Milestone 50, ARCHITECTURE #332).
--
-- The source is origin→destination pairs plus the publisher's own summary rows, and the
-- summaries are what every figure here is computed from: `96/000` "Total Migration-US
-- and Foreign" for moves, and the row naming the county itself ("Non-migrants") for the
-- returns filed in the same county both years. Summing the pair rows instead would
-- double-count the aggregates mixed among them. The pairs themselves feed
-- `stg_migration_flows`.
--
-- A return is a tax return, not a household: the people who file nothing — many retirees
-- and low earners — are missing on both sides. AGI is published as a total in thousands
-- of dollars, so an income here is a mean per return, never a median, and a handful of
-- very high earners can move it. A suppressed cell is -1 and is dropped.
{{ config(materialized='table') }}

with inflow as (
    select lpad(y2_statefips::varchar, 2, '0') || lpad(y2_countyfips::varchar, 3, '0') as geoid,
           lpad(y1_statefips::varchar, 2, '0') || lpad(y1_countyfips::varchar, 3, '0') as other,
           regexp_extract(filename, '/(\d{4})/', 1) as pair, n1, agi
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/inflow.parquet', filename=true)
    where n1 >= 0
),
outflow as (
    select lpad(y1_statefips::varchar, 2, '0') || lpad(y1_countyfips::varchar, 3, '0') as geoid,
           lpad(y2_statefips::varchar, 2, '0') || lpad(y2_countyfips::varchar, 3, '0') as other,
           regexp_extract(filename, '/(\d{4})/', 1) as pair, n1, agi
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/outflow.parquet', filename=true)
    where n1 >= 0
),
county as (
    select geoid, pair,
           max(case when other = '96000' then n1 end) as in_returns,
           max(case when other = '96000' then agi end) as in_agi,
           max(case when other = geoid then n1 end) as stay_returns,
           max(case when other = geoid then agi end) as stay_agi
    from inflow
    where substr(geoid, 1, 2) in ({{ var("state_fips") }})
    group by 1, 2
),
leaving as (
    select geoid, pair,
           max(case when other = '96000' then n1 end) as out_returns,
           max(case when other = '96000' then agi end) as out_agi
    from outflow
    where substr(geoid, 1, 2) in ({{ var("state_fips") }})
    group by 1, 2
),
moves as (
    select c.*, l.out_returns, l.out_agi
    from county c join leaving l using (geoid, pair)
    where c.in_returns > 0 and l.out_returns > 0 and c.stay_returns > 0
),
measured as (
    -- (metric, value, the file it is cited to). A figure from both files cites the
    -- inflow file, as the net always has: `fact_metric_observation` holds one release.
    select geoid, pair, 'net_migration_returns' as metric_id,
           (in_returns - out_returns)::double as value, 'inflow' as release_layer
    from moves
    union all
    select geoid, pair, 'irs_inflow_returns', in_returns::double, 'inflow' from moves
    union all
    select geoid, pair, 'irs_outflow_returns', out_returns::double, 'outflow' from moves
    union all
    -- Per 1,000 of the returns filed in the county in the first year: those who stayed
    -- and those who left.
    select geoid, pair, 'irs_net_migration_per_1000',
           (in_returns - out_returns) * 1000.0 / (stay_returns + out_returns), 'inflow'
    from moves
    union all
    select geoid, pair, 'irs_inflow_agi_per_return', in_agi * 1000.0 / in_returns, 'inflow'
    from moves
    union all
    select geoid, pair, 'irs_outflow_agi_per_return', out_agi * 1000.0 / out_returns, 'outflow'
    from moves
    union all
    select geoid, pair, 'irs_nonmigrant_agi_per_return', stay_agi * 1000.0 / stay_returns,
           'inflow'
    from moves
    union all
    -- Arrivals' mean income over stayers': above 1, newcomers report more than the
    -- households already there.
    select geoid, pair, 'irs_arrival_income_ratio',
           (in_agi::double / in_returns) / (stay_agi::double / stay_returns), 'inflow'
    from moves
    where stay_agi > 0
)
select
    'irs_migration' as source_id,
    metric_id,
    geoid,
    'county' as level,
    -- Pair '2223' compares tax years 2022 and 2023; the moves land in 2023.
    make_date(2000 + substr(pair, 3, 2)::int, 1, 1) as period_start,
    make_date(2000 + substr(pair, 3, 2)::int, 12, 31) as period_end,
    value,
    'fips' as match_method,
    release_layer,
    -- The year-pair directory ('2223') is the release vintage.
    pair as release_vintage
from measured
