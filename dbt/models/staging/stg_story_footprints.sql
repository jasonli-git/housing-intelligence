-- How big New Jersey's buildings are, town by town (the visual stories, 2026-10-23):
-- Microsoft's outlines, each placed in the town holding its centre. Houses are taken to
-- be the outlines between 400 and 6,000 square feet standing in a town's residential
-- land — sheds and garages fall below, warehouses and schools above — so the median is
-- of buildings the size of homes, not of homes known to be homes. Built once
-- `hip.sources.buildings` has landed.
{{ config(materialized='table', enabled=var('story_footprints_landed', false)) }}

with towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
buildings as (
    select ST_Point(lon, lat) as point, sqft
    from read_parquet('{{ var("parquet_dir") }}/msft_buildings/v2/buildings.parquet')
    where sqft between 400 and 6000
),
placed as (
    select t.geoid, b.sqft from buildings b join towns t on ST_Contains(t.geom, b.point)
),
year as (select {{ var('read_years')['msft_buildings'] }} as y)
select 'msft_buildings' as source_id, 'msft_median_footprint_sqft' as metric_id, geoid,
       'municipality' as level, make_date(y, 1, 1) as period_start,
       make_date(y, 12, 31) as period_end, median(sqft) as value,
       'point_in_polygon' as match_method, 'buildings' as release_layer,
       'v2' as release_vintage
from placed, year group by geoid, y
