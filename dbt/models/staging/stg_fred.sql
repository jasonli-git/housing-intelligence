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

-- The home page's national scoreboard (Milestone 57): monthly national series, each its
-- own FRED layer, dated to the month they describe. Starts arrive in thousands of units
-- at an annual rate and are stored as units.
union all

select
    'fred' as source_id,
    case series_id
        when 'ACTLISCOUUS' then 'realtor_active_listings'
        when 'PRIREDCOUUS' then 'realtor_price_reduced_listings'
        when 'MEDDAYONMARUS' then 'realtor_median_days_on_market'
        when 'CUSR0000SEHA' then 'cpi_rent_primary_residence'
        when 'HOUST' then 'housing_starts_saar'
        when 'MSACSR' then 'new_home_months_supply'
    end as metric_id,
    'US' as geoid,
    'nation' as level,
    date as period_start,
    last_day(date) as period_end,
    try_cast(value as double) * case when series_id = 'HOUST' then 1000 else 1 end as value,
    'national' as match_method,
    series_id as release_layer,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
where series_id in ('ACTLISCOUUS', 'PRIREDCOUUS', 'MEDDAYONMARUS', 'CUSR0000SEHA', 'HOUST', 'MSACSR')
  and try_cast(value as double) is not null

union all

-- The share of listings with a price cut: Realtor.com publishes the two counts, not the
-- share, so it is taken here, month by month, from the same release.
select
    'fred' as source_id,
    'realtor_price_reduced_share' as metric_id,
    'US' as geoid,
    'nation' as level,
    a.date as period_start,
    last_day(a.date) as period_end,
    100.0 * try_cast(r.value as double) / try_cast(a.value as double) as value,
    'national' as match_method,
    'PRIREDCOUUS' as release_layer,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet') a
join read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet') r
  on r.series_id = 'PRIREDCOUUS' and r.date = a.date
where a.series_id = 'ACTLISCOUUS'
  and try_cast(a.value as double) > 0
  and try_cast(r.value as double) is not null

union all

-- The median sale price of new houses (Census Bureau, quarterly): dated to its quarter.
select
    'fred' as source_id,
    'new_home_median_sale_price' as metric_id,
    'US' as geoid,
    'nation' as level,
    date as period_start,
    last_day(date + interval 2 month) as period_end,
    try_cast(value as double) as value,
    'national' as match_method,
    series_id as release_layer,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fred/current/*.parquet')
where series_id = 'MSPUS' and try_cast(value as double) is not null
