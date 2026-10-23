-- The spread of house-sized buildings in each county, in 200-square-foot bins (the
-- visual stories, 2026-10-23), for the ridgeline: the same buildings as
-- `stg_story_footprints`, counted by the county holding their centre.
{{ config(materialized='table', enabled=var('story_footprints_landed', false)) }}

with counties as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/county.parquet')
    where STATEFP = '34'
),
buildings as (
    select ST_Point(lon, lat) as point, sqft
    from read_parquet('{{ var("parquet_dir") }}/msft_buildings/v2/buildings.parquet')
    where sqft between 400 and 6000
),
placed as (
    select c.geoid, (floor(b.sqft / 200) * 200)::integer as bin
    from buildings b join counties c on ST_Contains(c.geom, b.point)
)
select 'how-big-the-houses-are' as story_id, 'buildings' as series, geoid,
       'county' as level, bin::varchar as x, count(*)::double as y,
       null::varchar as label, 'msft_buildings' as source_id, 'buildings' as layer,
       'v2' as vintage
from placed group by geoid, bin
