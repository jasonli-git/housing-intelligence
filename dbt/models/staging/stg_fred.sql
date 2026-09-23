-- FRED national macro series. Lands at the `nation` level against the synthetic US
-- region (ARCHITECTURE #30) rather than being attributed to a state.
--
-- One series at two frequencies (Milestone 26): Freddie Mac's weekly benchmark, which
-- prices today's cost card, and FRED's monthly average of it, kept for history.
{{ config(materialized='table') }}

with monthly as (

    select date, try_cast(value as double) as value
    from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
    where series_id = 'MORTGAGE30US'
      and try_cast(value as double) is not null

), weekly as (

    select date, try_cast(value as double) as value
    from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
    where series_id = 'MORTGAGE30US_weekly'
      and try_cast(value as double) is not null

), observed as (

    -- The newest week the survey has reported. A month ending after it is still in
    -- progress: FRED's average for it covers only the weeks so far, and dating it to
    -- the month's last day claimed a month nobody had observed yet — September 2026
    -- read 6.81% "for September" on the 23rd.
    select max(date) as through from weekly

)

select
    'fred' as source_id,
    'mortgage_rate_30y' as metric_id,
    'US' as geoid,
    'nation' as level,
    m.date as period_start,
    -- A month still in progress ends on the last week observed, so its period says how
    -- much of the month it covers. A finished month ends on its last day, as before.
    -- Without any weekly reading the month end stands, which is how every release
    -- before Milestone 26 was dated.
    case
        when o.through is not null
         and o.through < (m.date + interval 1 month - interval 1 day)::date
        then o.through
        else (m.date + interval 1 month - interval 1 day)::date
    end as period_end,
    m.value,
    'national' as match_method,
    -- FRED's release layer is the series id, not the region level.
    'MORTGAGE30US' as release_layer,
    'current' as release_vintage
from monthly m
cross join observed o
-- A week reported before the month it would average: nothing to date it by yet.
where o.through is null or m.date <= o.through

union all

select
    'fred' as source_id,
    'mortgage_rate_30y_weekly' as metric_id,
    'US' as geoid,
    'nation' as level,
    -- One reading per survey week, dated by FRED to the week's release day.
    w.date as period_start,
    w.date as period_end,
    w.value,
    'national' as match_method,
    'MORTGAGE30US_weekly' as release_layer,
    'current' as release_vintage
from weekly w
