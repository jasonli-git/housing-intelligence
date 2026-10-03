-- Which community water systems serve each home-bearing block, and how much of it
-- (Milestone 40, ARCHITECTURE #304).
--
-- NJDEP's service areas laid over the 2020 blocks: one row per block and system, with
-- the share of the block's area the system's retail area (`AREA_TYPE = 'S'`) covers.
-- Wholesale areas (`W`) sell to other systems, not to homes, and are left out. Areas
-- of two systems can overlap, so a block's shares can sum past one; the share of homes
-- on public water caps each block at all of it.
{{ config(materialized='table') }}

with areas as (
    select PWID as pwsid, SYS_NAME as system_name,
           ST_MakeValid(ST_GeomFromGeoJSON(geometry)) as geom
    from read_parquet('{{ var("parquet_dir") }}/njdep_water_areas/current/areas.parquet')
    where AREA_TYPE = 'S' and geometry is not null
)
select b.block_geoid,
       a.pwsid,
       any_value(a.system_name) as system_name,
       least(1.0, sum(ST_Area(ST_Intersection(b.geom, a.geom)) / ST_Area(b.geom))) as share
from {{ ref('stg_block_homes') }} b
join areas a on ST_Intersects(b.geom, a.geom)
group by 1, 2
having share > 0
