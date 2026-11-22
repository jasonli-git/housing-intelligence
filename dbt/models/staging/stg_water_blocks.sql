-- Which community water systems serve each home-bearing block, and how much of it
-- (Milestone 40, ARCHITECTURE #304).
--
-- NJDEP's service areas laid over the 2020 blocks: one row per block and system, with
-- the share of the block's area the system's retail area (`AREA_TYPE = 'S'`) covers.
-- Wholesale areas (`W`) sell to other systems, not to homes, and are left out. Areas
-- of two systems can overlap, so a block's shares can sum past one; the share of homes
-- on public water caps each block at all of it.
--
-- Pennsylvania's areas are EPA's (`epa_water_areas`, Milestone 63), its residential
-- kinds of area, partly modelled: an estimate. Each block is laid over its own state's
-- map only, and each row names the map it came from.
{{ config(materialized='table') }}

with areas as (
    select '34' as state, 'njdep_water_areas' as area_source, 'areas' as area_layer,
           PWID as pwsid, SYS_NAME as system_name,
           ST_MakeValid(ST_GeomFromGeoJSON(geometry)) as geom
    from read_parquet('{{ var("parquet_dir") }}/njdep_water_areas/current/areas.parquet')
    where AREA_TYPE = 'S' and geometry is not null
    {%- if var('epa_water_areas_landed', false) %}
    union all
    select st.fips, 'epa_water_areas',
           regexp_extract(filename, '/(areas_[a-z]{2})\.parquet$', 1),
           PWSID, PWS_Name, ST_MakeValid(ST_GeomFromGeoJSON(geometry))
    from read_parquet('{{ var("parquet_dir") }}/epa_water_areas/current/areas_*.parquet',
                      filename = true) a
    join (values {% for pair in var('state_fips_pairs') %}('{{ pair[0] }}', '{{ pair[1] }}'){{ ", " if not loop.last }}{% endfor %}) st(postal, fips)
      on st.postal = left(a.PWSID, 2)
    where geometry is not null
    {%- endif %}
)
select b.block_geoid,
       a.pwsid,
       any_value(a.system_name) as system_name,
       any_value(a.area_source) as area_source,
       any_value(a.area_layer) as area_layer,
       least(1.0, sum(ST_Area(ST_Intersection(b.geom, a.geom)) / ST_Area(b.geom))) as share
from {{ ref('stg_block_homes') }} b
-- The state after the spatial join, as in `stg_flood_blocks`.
join areas a on ST_Intersects(b.geom, a.geom)
where a.state = left(b.block_geoid, 2)
group by 1, 2
having share > 0
