-- Days a year New Jersey's counties passed 90°F, since 1951 (the visual stories,
-- 2026-10-23): NOAA's nClimGrid-Daily maximum temperature averaged over each county,
-- counted where it reached 32.2°C, May to September. A county average runs cooler than
-- its hottest blocks, so these are a floor on how often a town felt 90°F. The state's
-- figure is its counties' average count. Built once `hip.sources.nclimgrid` has landed.
{{ config(materialized='table', enabled=var('story_heat_landed', false)) }}

with days as (
    select lpad(fips::varchar, 5, '0') as geoid,
           cast(date as date) as day,
           try_cast(trim(tmax::varchar) as double) as tmax,
           regexp_extract(filename, 'noaa_nclimgrid/([0-9]{4})/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/noaa_nclimgrid/*/tmax.parquet', filename=true)
),
counted as (
    select geoid, year(day) as year, any_value(vintage) as vintage,
           count(*) filter (where tmax >= 32.2222)::double as hot
    -- A 30-day month's file carries a 31st row for each county, undated and -999.99.
    from days where tmax > -100 and day is not null group by 1, 2
)
select 'noaa_nclimgrid' as source_id, 'nclimgrid_days_over_90' as metric_id, geoid,
       'county' as level, make_date(year, 1, 1) as period_start,
       make_date(year, 12, 31) as period_end, hot as value, 'fips' as match_method,
       'tmax' as release_layer, vintage as release_vintage
from counted
union all
select 'noaa_nclimgrid', 'nclimgrid_days_over_90', '34', 'state', make_date(year, 1, 1),
       make_date(year, 12, 31), avg(hot), 'fips', 'tmax', any_value(vintage)
from counted group by year
