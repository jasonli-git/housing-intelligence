-- How long the scheduled ride to Manhattan is from each New Jersey town (the visual
-- stories, 2026-10-23), from NJ Transit's timetables (`hip.sources.njt_gtfs`).
--
-- One ordinary weekday: the Wednesday in each feed with the most trips running. A trip
-- counts when it reaches its Manhattan end between 6 and 10 in the morning, and a stop's
-- ride is the trip's arrival there less its departure from the stop. Rail ends at New
-- York Penn Station; a train ending at Hoboken or Secaucus Junction counts with a fixed
-- allowance for the onward PATH or train (20 and 15 minutes), which the story states.
-- Buses end at the Port Authority Bus Terminal. A town's figure is the fastest ride from
-- any stop inside it; scheduled, not real, times. Built once both feeds have landed.
{{ config(materialized='table', enabled=var('story_transit_landed', false)) }}

{% set feeds = ['rail', 'bus'] %}
with
{% for feed in feeds %}
{{ feed }}_service as (
    select service_id from read_parquet('{{ var("parquet_dir") }}/njt_gtfs/current/{{ feed }}_calendar_dates.parquet')
    where exception_type = '1' and date = (
        select date from read_parquet('{{ var("parquet_dir") }}/njt_gtfs/current/{{ feed }}_calendar_dates.parquet')
        where exception_type = '1' and dayofweek(strptime(date, '%Y%m%d')) = 3
        group by date order by count(*) desc, date limit 1
    )
),
{{ feed }}_times as (
    select st.trip_id, st.stop_id, try_cast(st.stop_sequence as integer) as seq,
           -- HH:MM:SS, the hour past 24 for a trip running after midnight.
           try_cast(split_part(st.arrival_time, ':', 1) as integer) * 3600
             + try_cast(split_part(st.arrival_time, ':', 2) as integer) * 60 as arrive,
           try_cast(split_part(st.departure_time, ':', 1) as integer) * 3600
             + try_cast(split_part(st.departure_time, ':', 2) as integer) * 60 as depart
    from read_parquet('{{ var("parquet_dir") }}/njt_gtfs/current/{{ feed }}_stop_times.parquet') st
    join read_parquet('{{ var("parquet_dir") }}/njt_gtfs/current/{{ feed }}_trips.parquet') t
      using (trip_id)
    where t.service_id in (select service_id from {{ feed }}_service)
),
{{ feed }}_stops as (
    select stop_id, upper(stop_name) as name, try_cast(stop_lat as double) as lat,
           try_cast(stop_lon as double) as lon
    from read_parquet('{{ var("parquet_dir") }}/njt_gtfs/current/{{ feed }}_stops.parquet')
),
{% endfor %}
ends as (
    select 'rail' as feed, stop_id,
           case when name like 'NEW YORK PENN%' then 0
                when name like 'SECAUCUS%' then 15 * 60
                when name like 'HOBOKEN%' then 20 * 60 end as allowance
    from rail_stops
    where name like 'NEW YORK PENN%' or name like 'SECAUCUS%' or name like 'HOBOKEN%'
    union all
    select 'bus', stop_id, 0 from bus_stops where name like '%PORT AUTHORITY%'
),
times as (
    select 'rail' as feed, * from rail_times union all select 'bus', * from bus_times
),
stops as (
    select 'rail' as feed, * from rail_stops union all select 'bus', * from bus_stops
),
rides as (
    select o.feed, o.stop_id, min(e.arrive - o.depart + d.allowance) / 60.0 as minutes
    from times e
    join ends d on d.feed = e.feed and d.stop_id = e.stop_id
    join times o on o.feed = e.feed and o.trip_id = e.trip_id and o.seq < e.seq
    where e.arrive between 6 * 3600 and 10 * 3600
      and o.stop_id not in (select stop_id from ends where feed = o.feed)
    group by 1, 2
),
towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
placed as (
    select r.feed, t.geoid, min(r.minutes) as minutes
    from rides r join stops s using (feed, stop_id)
    join towns t on ST_Contains(t.geom, ST_Point(s.lon, s.lat))
    group by 1, 2
)
select 'njt_gtfs' as source_id, 'njt_' || feed || '_minutes_to_manhattan' as metric_id,
       geoid, 'municipality' as level, make_date(y, 1, 1) as period_start,
       make_date(y, 12, 31) as period_end, minutes as value, 'point_in_polygon' as match_method,
       feed as release_layer, 'current' as release_vintage
from placed, (select {{ var('read_years')['njt_gtfs'] }} as y) as year
