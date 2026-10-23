-- What New Jersey's towns name their streets (the visual stories, 2026-10-22), from
-- TIGER's road files: the distinct names of local roads (MAF/TIGER class S1400) in each
-- town, a road placed in the town holding the midpoint of its first edge there.
--
-- Two shares of those names: ones ending in Court, Circle, Lane, Way, Place or Terrace,
-- the vocabulary of post-war subdivisions and their dead ends, and ones ending in Street
-- or Avenue, the grid's. A directional after the suffix ("Main St N") is allowed.
{{ config(materialized='table') }}

with roads as (
    select FULLNAME as name, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger_roads/*/roads_*.parquet')
    where MTFCC = 'S1400' and FULLNAME is not null
),
towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
named as (
    select distinct t.geoid, r.name
    from roads r join towns t on ST_Contains(t.geom, ST_PointOnSurface(r.geom))
),
summed as (
    select geoid,
           count(*) filter (where regexp_matches(name, ' (Ct|Cir|Ln|Way|Pl|Ter)( [NSEW]{1,2})?$'))
             / count(*) as cul,
           count(*) filter (where regexp_matches(name, ' (St|Ave)( [NSEW]{1,2})?$'))
             / count(*) as grid,
           count(*) as names
    from named group by 1
    having count(*) >= 10
)
select 'census_tiger_roads' as source_id, metric_id, geoid, 'municipality' as level,
       make_date({{ var('tiger_roads_year') }}, 1, 1) as period_start,
       make_date({{ var('tiger_roads_year') }}, 12, 31) as period_end,
       value::double as value, 'point_in_polygon' as match_method,
       -- Each town's names come from its own county's file (`TigerRoadsAdapter`).
       'roads_' || substr(geoid, 3, 3) as release_layer,
       '{{ var("tiger_roads_year") }}' as release_vintage
from summed,
     lateral (values ('streets_court_circle_share', cul),
                     ('streets_street_avenue_share', grid)) as v(metric_id, value)
