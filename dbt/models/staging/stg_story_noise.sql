-- Transportation noise where New Jersey's homes are (the visual stories, 2026-10-22),
-- from BTS's National Transportation Noise Map, 2022/2023, downloaded by hand and cut to
-- the imagery grid at acquisition (`hip.sources.manual_rasters`): the shares of homes
-- where the modelled 24-hour level is 55 and 65 dB(A) or more. Built once the file has
-- landed (`story_noise_landed`).
{{ config(materialized='table', enabled=var('story_noise_landed', false)) }}

with noise as (
    select col, row, value, xmin, ymax, dx, dy
    from read_parquet('{{ var("parquet_dir") }}/bts_noise/*/noise.parquet')
),
grid as (select any_value(xmin) as xmin, any_value(ymax) as ymax, any_value(dx) as dx,
                any_value(dy) as dy from noise),
located as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           floor((ST_X(h.point) - g.xmin) / g.dx)::integer as col,
           floor((g.ymax - ST_Y(h.point)) / g.dy)::integer as row
    from {{ ref('stg_block_homes') }} h cross join grid g
),
sampled as (
    select l.municipality_geoid, l.county_geoid, l.zcta_geoid, l.homes, n.value as db
    from located l left join noise n using (col, row)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, db from sampled
    union all select county_geoid, 'county', homes, db from sampled
    union all select zcta_geoid, 'zip', homes, db from sampled
    union all select '34', 'state', homes, db from sampled
),
summed as (
    select geoid, level,
           sum(homes) filter (where db >= 55) / nullif(sum(homes) filter (where db is not null), 0) as loud,
           sum(homes) filter (where db >= 65) / nullif(sum(homes) filter (where db is not null), 0) as louder
    from places where geoid is not null group by 1, 2
)
-- Aviation and rail 2022, road 2023: dated by its newest part.
select 'bts_noise' as source_id, metric_id, geoid, level,
       make_date(2023, 1, 1) as period_start, make_date(2023, 12, 31) as period_end,
       coalesce(value, 0) as value, 'block_pixel' as match_method,
       'noise' as release_layer, '2023' as release_vintage
from summed,
     lateral (values ('noise_homes_share_55db', loud),
                     ('noise_homes_share_65db', louder)) as v(metric_id, value)
