-- Transportation noise and night-time brightness where New Jersey's homes are (the
-- visual stories, 2026-10-22), from the two rasters the owner downloads by hand
-- (`hip.sources.manual_rasters`), cut to the imagery grid at acquisition.
--
-- Built only once both have landed (`story_rasters_landed`): until the downloads are
-- handed in, the rest of the pipeline runs without them.
{{ config(materialized='table', enabled=var('story_rasters_landed', false)) }}

with noise as (
    select col, row, value, xmin, ymax, dx, dy
    from read_parquet('{{ var("parquet_dir") }}/bts_noise/*/noise.parquet')
),
lights_file as (
    select *, regexp_extract(filename, 'eog_vnl/([^/]+)/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/eog_vnl/*/lights.parquet', filename=true)
),
lights as (
    select col, row, value, xmin, ymax, dx, dy, vintage from lights_file
    where vintage = (select max(vintage) from lights_file)
),
-- Both are cut to one grid, so one pixel address serves both.
grid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                any_value(dy) as dy from noise),
located as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           floor((ST_X(h.point) - g.xmin) / g.dx)::integer as col,
           floor((g.ymax - ST_Y(h.point)) / g.dy)::integer as row
    from {{ ref('stg_block_homes') }} h cross join grid g
),
sampled as (
    select l.municipality_geoid, l.county_geoid, l.zcta_geoid, l.homes,
           n.value as db, v.value as radiance
    from located l
    left join noise n using (col, row)
    left join lights v using (col, row)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, db, radiance from sampled
    union all select county_geoid, 'county', homes, db, radiance from sampled
    union all select zcta_geoid, 'zip', homes, db, radiance from sampled
    union all select '34', 'state', homes, db, radiance from sampled
),
summed as (
    select geoid, level,
           sum(homes) filter (where db >= 55) / nullif(sum(homes) filter (where db is not null), 0) as loud,
           sum(homes) filter (where db >= 65) / nullif(sum(homes) filter (where db is not null), 0) as louder,
           sum(homes * radiance) filter (where radiance is not null)
             / nullif(sum(homes) filter (where radiance is not null), 0) as radiance
    from places where geoid is not null group by 1, 2
),
year as (select (select max(vintage) from lights)::integer as lights_year)
select * from (
    select 'bts_noise' as source_id, metric_id, geoid, level,
           -- Aviation and rail 2022, road 2023: dated by its newest part.
           make_date(2023, 1, 1) as period_start, make_date(2023, 12, 31) as period_end,
           coalesce(value, 0) as value, 'block_pixel' as match_method,
           'noise' as release_layer, '2023' as release_vintage
    from summed,
         lateral (values ('noise_homes_share_55db', loud),
                         ('noise_homes_share_65db', louder)) as v(metric_id, value)
    union all
    select 'eog_vnl', 'lights_homes_radiance', geoid, level,
           make_date(lights_year, 1, 1), make_date(lights_year, 12, 31),
           radiance, 'block_pixel', 'lights', lights_year::varchar
    from summed, year where radiance is not null
)
