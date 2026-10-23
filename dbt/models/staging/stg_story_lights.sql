-- Night-time brightness where New Jersey's homes are (the visual stories, 2026-10-22),
-- from EOG's annual VIIRS night lights, downloaded by hand and cut to the imagery grid
-- at acquisition (`hip.sources.manual_rasters`). Built once the file has landed
-- (`story_lights_landed`), so the pipeline runs before it is handed in.
{{ config(materialized='table', enabled=var('story_lights_landed', false)) }}

with lights_file as (
    select *, regexp_extract(filename, 'eog_vnl/([^/]+)/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/eog_vnl/*/lights.parquet', filename=true)
),
lights as (
    select col, row, value, xmin, ymax, dx, dy, vintage from lights_file
    where vintage = (select max(vintage) from lights_file)
),
grid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                any_value(dy) as dy from lights),
located as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           floor((ST_X(h.point) - g.xmin) / g.dx)::integer as col,
           floor((g.ymax - ST_Y(h.point)) / g.dy)::integer as row
    from {{ ref('stg_block_homes') }} h cross join grid g
),
sampled as (
    select l.municipality_geoid, l.county_geoid, l.zcta_geoid, l.homes, v.value as radiance
    from located l left join lights v using (col, row)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, radiance from sampled
    union all select county_geoid, 'county', homes, radiance from sampled
    union all select zcta_geoid, 'zip', homes, radiance from sampled
    union all select '34', 'state', homes, radiance from sampled
),
summed as (
    select geoid, level,
           sum(homes * radiance) filter (where radiance is not null)
             / nullif(sum(homes) filter (where radiance is not null), 0) as radiance
    from places where geoid is not null group by 1, 2
),
year as (select (select max(vintage) from lights)::integer as y)
select 'eog_vnl' as source_id, 'lights_homes_radiance' as metric_id, geoid, level,
       make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       radiance as value, 'block_pixel' as match_method, 'lights' as release_layer,
       y::varchar as release_vintage
from summed, year where radiance is not null
