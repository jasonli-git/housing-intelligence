-- Tree canopy and ground height where New Jersey's homes are (the visual stories,
-- 2026-10-22): each 2020 census block's interior point placed in its ~100 m pixel of
-- the image `hip.sources.imagery` cut, its homes the weight.
--
-- Per municipality, county, ZIP code and the state: the homes-weighted mean canopy
-- (a share, 0 to 1), the homes-weighted mean ground height in feet, and the share of
-- homes standing under 10 feet above sea level. Where people live, not across a town's
-- fields and marsh. A block's homes are all at its interior point, which in a large
-- rural block can be far from some of them.
{{ config(materialized='table') }}

with canopy_file as (
    select *, regexp_extract(filename, 'usfs_tcc/([^/]+)/', 1) as vintage
    from read_parquet('{{ var("parquet_dir") }}/usfs_tcc/*/canopy.parquet', filename=true)
),
canopy as (
    select col, row, value, xmin, ymax, dx, dy, vintage from canopy_file
    where vintage = (select max(vintage) from canopy_file)
),
elevation as (
    select col, row, value, xmin, ymax, dx, dy
    from read_parquet('{{ var("parquet_dir") }}/usgs_3dep/current/elevation.parquet')
),
grid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                any_value(dy) as dy from canopy),
egrid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                 any_value(dy) as dy from elevation),
blocks as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           ST_X(h.point) as lon, ST_Y(h.point) as lat
    from {{ ref('stg_block_homes') }} h
),
-- Each block's pixel in each image, worked out first: the joins below are then plain
-- equality joins, which DuckDB will not do on columns of a cross-joined grid.
located as (
    select b.*,
           floor((b.lon - g.xmin) / g.dx)::integer as c_col,
           floor((g.ymax - b.lat) / g.dy)::integer as c_row,
           floor((b.lon - eg.xmin) / eg.dx)::integer as e_col,
           floor((eg.ymax - b.lat) / eg.dy)::integer as e_row
    from blocks b cross join grid g cross join egrid eg
),
sampled as (
    select l.municipality_geoid, l.county_geoid, l.zcta_geoid, l.homes,
           c.value / 100.0 as canopy, e.value * 3.28084 as feet
    from located l
    left join canopy c on c.col = l.c_col and c.row = l.c_row
    left join elevation e on e.col = l.e_col and e.row = l.e_row
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, canopy, feet from sampled
    union all
    select county_geoid, 'county', homes, canopy, feet from sampled
    union all
    select zcta_geoid, 'zip', homes, canopy, feet from sampled
    union all
    select '34', 'state', homes, canopy, feet from sampled
),
summed as (
    select geoid, level,
           sum(homes * canopy) filter (where canopy is not null)
             / nullif(sum(homes) filter (where canopy is not null), 0) as canopy,
           sum(homes * feet) filter (where feet is not null)
             / nullif(sum(homes) filter (where feet is not null), 0) as feet,
           sum(homes) filter (where feet < 10)
             / nullif(sum(homes) filter (where feet is not null), 0) as low
    from places where geoid is not null group by 1, 2
),
dated as (
    select (select max(vintage) from canopy)::integer as canopy_year,
           {{ var('read_years')['usgs_3dep'] }} as elevation_year
)
select * from (
    select 'usfs_tcc' as source_id, 'tree_canopy_homes_share' as metric_id, geoid, level,
           make_date(canopy_year, 1, 1) as period_start, make_date(canopy_year, 12, 31) as period_end,
           canopy as value, 'block_pixel' as match_method, 'canopy' as release_layer,
           canopy_year::varchar as release_vintage
    from summed, dated where canopy is not null
    union all
    select 'usgs_3dep', metric_id, geoid, level,
           make_date(elevation_year, 1, 1), make_date(elevation_year, 12, 31),
           value, 'block_pixel', 'elevation', 'current'
    from summed, dated,
         lateral (values ('elevation_homes_feet', feet),
                         ('elevation_low_homes_share', coalesce(low, 0))) as v(metric_id, value)
    where feet is not null
)
