-- New Jersey's 2020 census blocks that hold homes, and the regions each sits in
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
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
zctas as (
    -- New Jersey's ZIP codes begin 07 and 08.
    select GEOID20 as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/zcta.parquet')
    where left(GEOID20, 2) in ('07', '08')
),
-- Inner spatial joins, keyed back by block: under a LEFT join DuckDB 1.5's spatial
-- join can emit a matched row a second time as unmatched (`stg_njdep_sites`).
block_town as (
    select b.block_geoid, t.geoid from blocks b join towns t on ST_Contains(t.geom, b.point)
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
       b.geom
from blocks b
left join block_town t on t.block_geoid = b.block_geoid
left join block_zcta z on z.block_geoid = b.block_geoid
