-- Whether each home-bearing block is near transit (Milestone 45, ARCHITECTURE #314):
-- its interior point within half a mile (2,640 feet) of a rail stop, and within a
-- quarter mile (1,320 feet) of a bus stop, in a straight line.
--
-- The distances are the ones planners use for a walk to a station and to a bus stop.
-- Straight-line, so a river or a highway without a crossing reads nearer than the walk
-- is; and a block's homes are all placed at its interior point, which in a large rural
-- block can be far from some of them.
{{ config(materialized='table') }}

with blocks as (
    select block_geoid,
           ST_Transform(point, 'EPSG:4269', 'EPSG:3424', always_xy := true) as point
    from {{ ref('stg_block_homes') }}
),
rail_zones as (
    select ST_Buffer(point, 2640) as zone from {{ ref('stg_transit_stops') }} where is_rail
),
bus_zones as (
    select ST_Buffer(point, 1320) as zone from {{ ref('stg_transit_stops') }} where is_bus
),
-- Inner spatial joins, keyed back by block (`stg_block_homes`).
near_rail as (
    select distinct b.block_geoid from blocks b join rail_zones z
        on ST_Intersects(z.zone, b.point)
),
near_bus as (
    select distinct b.block_geoid from blocks b join bus_zones z
        on ST_Intersects(z.zone, b.point)
)
select b.block_geoid,
       r.block_geoid is not null as near_rail,
       s.block_geoid is not null as near_bus
from blocks b
left join near_rail r using (block_geoid)
left join near_bus s using (block_geoid)
