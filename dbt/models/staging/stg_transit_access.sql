-- The share of homes near transit, per municipality, county, ZIP code and the state
-- (Milestone 45, ARCHITECTURE #314): `stg_transit_blocks` weighed by 2020's homes.
--
-- Dated by the year BTS compiled the stops, not the year they were read: the layer
-- carries its compile date. Nearness to a stop, not service: how often a train or bus
-- calls there is not in the National Transit Map.
{{ config(materialized='table') }}

with blocks as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           t.near_rail, t.near_bus
    from {{ ref('stg_block_homes') }} h
    join {{ ref('stg_transit_blocks') }} t using (block_geoid)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, near_rail,
           near_bus from blocks
    union all
    select county_geoid, 'county', homes, near_rail, near_bus from blocks
    union all
    select zcta_geoid, 'zip', homes, near_rail, near_bus from blocks
    union all
    select '34', 'state', homes, near_rail, near_bus from blocks
),
summed as (
    select geoid, level,
           sum(homes) filter (where near_rail) / sum(homes) as rail,
           sum(homes) filter (where near_bus) / sum(homes) as bus,
           sum(homes) filter (where near_rail or near_bus) / sum(homes) as any_stop
    from places where geoid is not null group by 1, 2
),
compiled as (
    select year(max(download_date::date)) as y
    from read_parquet('{{ var("parquet_dir") }}/bts_ntm/current/stops.parquet')
)
select 'bts_ntm' as source_id, metric_id, geoid, level,
       make_date(compiled.y, 1, 1) as period_start,
       make_date(compiled.y, 12, 31) as period_end,
       coalesce(value, 0)::double as value, 'block_distance' as match_method,
       'stops' as release_layer, 'current' as release_vintage
from summed, compiled,
     lateral (values ('transit_rail_homes_share', rail),
                     ('transit_bus_homes_share', bus),
                     ('transit_any_homes_share', any_stop)) as v(metric_id, value)
