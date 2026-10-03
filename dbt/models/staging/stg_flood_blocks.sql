-- How much of each home-bearing block lies in each kind of flood area (Milestone 40,
-- ARCHITECTURE #301): FEMA's 1% and 0.2% zones and what FEMA has determined at all,
-- and NJDEP's tidal climate-adjusted area. One row per block, each share 0 to 1.
--
-- FEMA's zones partition the land, so a block's pieces within a class add without
-- overlap. NJDEP's tidal polygons can overlap one another, and repair can leave slivers
-- doubled, so every share is capped at one.
{{ config(materialized='table') }}

with blocks as (
    select block_geoid, geom, ST_Area(geom) as area from {{ ref('stg_block_homes') }}
),
overlaid as (
    select b.block_geoid, p.class,
           sum(ST_Area(ST_Intersection(b.geom, p.geom))) / any_value(b.area) as share
    from blocks b
    join {{ ref('stg_flood_pieces') }} p on ST_Intersects(b.geom, p.geom)
    group by 1, 2
),
pivoted as (
    select block_geoid,
           least(1.0, coalesce(sum(share) filter (where class = 'high'), 0)) as high,
           least(1.0, coalesce(sum(share) filter (where class = 'moderate'), 0))
               as moderate,
           least(1.0, coalesce(sum(share) filter (
               where class in ('high', 'moderate', 'minimal')), 0)) as mapped,
           least(1.0, coalesce(sum(share) filter (where class = 'tidal'), 0)) as tidal
    from overlaid group by 1
)
select b.block_geoid,
       coalesce(p.high, 0) as high,
       coalesce(p.moderate, 0) as moderate,
       coalesce(p.mapped, 0) as mapped,
       coalesce(p.tidal, 0) as tidal
from blocks b
left join pivoted p using (block_geoid)
