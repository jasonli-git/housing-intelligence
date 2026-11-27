-- Where New Jersey lives (the visual stories, 2026-11-27): the 2020 Census's people by
-- block, for the spike map and the most crowded towns.
--
-- `cells`: every block's people placed at its interior point and summed into squares
-- 1.6 km a side, on a grid of longitude scaled by the cosine of 40.1° (the state's
-- middle) and latitude; x is the square's centre as "lon,lat". Only squares with people.
-- `town_people` and `town_land`: each town's people and square miles of land, summed
-- from the blocks whose interior point falls in it. Blocks nest in towns, so a block's
-- point places it whole; the county is matched after the spatial join, as in
-- `stg_block_homes`, so a 2020 point a few metres over a 2025 county line is not misplaced.
{{ config(materialized='table') }}

with blocks as (
    select GEOID20 as block_geoid, POP20 as people, ALAND20 as land,
           INTPTLON20::double as lon, INTPTLAT20::double as lat
    from read_parquet('{{ var("parquet_dir") }}/census_blocks/2020/blocks_NJ.parquet')
),
cells as (
    select floor(lon * 85.2117 / 1.6) as i, floor(lat * 110.574 / 1.6) as j,
           sum(people) as people
    from blocks where people > 0
    group by 1, 2
),
towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
placed as materialized (
    select b.block_geoid, b.people, b.land, t.geoid
    from blocks b join towns t on ST_Contains(t.geom, ST_Point(b.lon, b.lat))
),
by_town as (
    select geoid, sum(people) as people, sum(land) / 2589988.11 as sq_mi
    from placed where left(geoid, 5) = left(block_geoid, 5)
    group by geoid
),
rows as (
    select 'cells' as series, null::varchar as geoid, null::varchar as level,
           printf('%.4f,%.4f', (i + 0.5) * 1.6 / 85.2117, (j + 0.5) * 1.6 / 110.574) as x,
           people::double as y
    from cells
    union all
    select 'town_people', geoid, 'municipality', '1', people::double from by_town
    union all
    select 'town_land', geoid, 'municipality', '1', sq_mi from by_town
)
select 'where-new-jersey-lives' as story_id, series, geoid, level, x, y,
       null::varchar as label,
       'census_blocks' as source_id, 'blocks' as layer, '2020' as vintage
from rows
