-- The covered states' 2020 census blocks that hold homes, and the regions each sits in
-- (Milestone 40, ARCHITECTURE #301).
--
-- The weights behind every share of homes this milestone publishes: flood zones and
-- water service areas are laid over blocks, and a block's homes are taken as spread
-- evenly across it. Blocks nest exactly in counties and county subdivisions, so a
-- block's interior point places it in its municipality and ZCTA without a split.
-- 113,333 of 137,972 blocks hold homes; the rest are left out.
{{ config(materialized='table') }}

with blocks as (
    select GEOID20 as block_geoid,
           HOUSING20 as homes,
           ST_GeomFromWKB(geom_wkb) as geom,
           ST_Point(INTPTLON20::double, INTPTLAT20::double) as point
    from read_parquet('{{ var("parquet_dir") }}/census_blocks/2020/blocks_*.parquet')
    where HOUSING20 > 0
),
towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_*.parquet')
    where COUSUBFP <> '00000' and STATEFP in ({{ var('state_fips') }})
),
zctas as (
    -- Every ZCTA: a block's interior point picks its own, and a ZCTA that crosses a
    -- state line is the Census's geography, not an error. (Until Milestone 63 only
    -- New Jersey's 07 and 08 prefixes were read.)
    select GEOID20 as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/zcta.parquet')
),
-- Inner spatial joins, keyed back by block: under a LEFT join DuckDB 1.5's spatial
-- join can emit a matched row a second time as unmatched (`stg_njdep_sites`).
-- A block's town is always in the block's own county. The 2025 town lines can put a
-- 2020 block's interior point a few metres over a county line (one Columbia County, PA
-- block in a Luzerne town), so the county is matched after the spatial join (fenced
-- off, as in `stg_flood_blocks`), and a block left without a town takes the town of its
-- own county it overlaps most.
point_town as materialized (
    select b.block_geoid, t.geoid from blocks b join towns t on ST_Contains(t.geom, b.point)
),
by_point as (
    select * from point_town where left(geoid, 5) = left(block_geoid, 5)
),
by_overlap as (
    select b.block_geoid, arg_max(t.geoid, ST_Area(ST_Intersection(b.geom, t.geom))) as geoid
    from blocks b
    join towns t on left(t.geoid, 5) = left(b.block_geoid, 5)
    where b.block_geoid not in (select block_geoid from by_point)
      and ST_Intersects(b.geom, t.geom)
    group by 1
),
block_town as (
    select * from by_point union all select * from by_overlap
),
block_zcta as (
    select b.block_geoid, z.geoid from blocks b join zctas z on ST_Contains(z.geom, b.point)
)
select b.block_geoid,
       left(b.block_geoid, 5) as county_geoid,
       left(b.block_geoid, 12) as block_group_geoid,
       t.geoid as municipality_geoid,
       z.geoid as zcta_geoid,
       b.homes,
       b.geom,
       -- The Census's interior point, which Milestone 45 measures distance to transit
       -- from (`stg_transit_blocks`).
       b.point
from blocks b
left join block_town t on t.block_geoid = b.block_geoid
left join block_zcta z on z.block_geoid = b.block_geoid
