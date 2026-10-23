-- How paved the ground is where New Jersey's homes are (the visual stories,
-- 2026-10-23): NLCD's impervious share, averaged onto the imagery grid at acquisition
-- (`hip.sources.nlcd`), sampled at each 2020 census block's interior point and weighted
-- by its homes, as the canopy is (`stg_story_raster`). Built once it has landed.
{{ config(materialized='table', enabled=var('story_impervious_landed', false)) }}

with imp_file as (
    select *, regexp_extract(filename, 'mrlc_nlcd/([^/]+)/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/mrlc_nlcd/*/impervious.parquet', filename=true)
),
imp as (
    select col, row, value, xmin, ymax, dx, dy, vintage from imp_file
    where vintage = (select max(vintage) from imp_file)
),
grid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                any_value(dy) as dy from imp),
located as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           floor((ST_X(h.point) - g.xmin) / g.dx)::integer as col,
           floor((g.ymax - ST_Y(h.point)) / g.dy)::integer as row
    from {{ ref('stg_block_homes') }} h cross join grid g
),
sampled as (
    select l.municipality_geoid, l.county_geoid, l.zcta_geoid, l.homes,
           v.value / 100.0 as paved
    from located l left join imp v using (col, row)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, paved from sampled
    union all select county_geoid, 'county', homes, paved from sampled
    union all select zcta_geoid, 'zip', homes, paved from sampled
    union all select '34', 'state', homes, paved from sampled
),
summed as (
    select geoid, level,
           sum(homes * paved) filter (where paved is not null)
             / nullif(sum(homes) filter (where paved is not null), 0) as paved
    from places where geoid is not null group by 1, 2
),
year as (select (select max(vintage) from imp)::integer as y)
select 'mrlc_nlcd' as source_id, 'nlcd_impervious_homes_share' as metric_id, geoid,
       level, make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       paved as value, 'block_pixel' as match_method, 'impervious' as release_layer,
       y::varchar as release_vintage
from summed, year where paved is not null
