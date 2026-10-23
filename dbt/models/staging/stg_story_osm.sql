-- Chains and diners in each town, from OpenStreetMap (the visual stories, 2026-10-22).
--
-- A brand's places counted once each: a Wawa is often mapped twice, the store and its
-- fuel canopy, so a place within 150 metres of another of the same brand with a smaller
-- id is dropped. A diner is a restaurant tagged cuisine=diner or named one. Counted in
-- the municipality, county and ZIP code holding the point; every town gets a row, zero
-- where none is mapped, so a missing count reads as none mapped rather than unknown.
-- © OpenStreetMap contributors, ODbL: these counts are offered under the same licence.
{{ config(materialized='table') }}

with raw as (
    select osm_id, name, brand, amenity, cuisine, ST_Point(lon, lat) as point
    from read_parquet('{{ var("parquet_dir") }}/osm_nj/current/places.parquet')
),
labelled as (
    select osm_id, point,
           case
               when brand = 'Wawa' then 'wawa'
               when brand in ('QuickChek', 'Quick Chek') or name ilike 'quick%chek%' then 'quickchek'
               when brand = 'Starbucks' then 'starbucks'
               when brand like 'Dunkin%' then 'dunkin'
               when brand = 'Trader Joe''s' then 'trader_joes'
               when brand = 'Whole Foods Market' then 'whole_foods'
               when cuisine ilike '%diner%'
                 or (amenity = 'restaurant' and name ilike '%diner%') then 'diner'
           end as kind
    from raw
),
kept as (
    select l.* from labelled l
    where l.kind is not null
      and not exists (
          select 1 from labelled o
          where o.kind = l.kind and o.osm_id < l.osm_id
            -- About 150 metres at New Jersey's latitude, in degrees.
            and abs(ST_X(o.point) - ST_X(l.point)) < 0.0018
            and abs(ST_Y(o.point) - ST_Y(l.point)) < 0.00135
      )
),
towns as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
counties as (
    select GEOID as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/county.parquet')
    where STATEFP = '34'
),
placed as (
    select k.kind, t.geoid, 'municipality' as level from kept k join towns t on ST_Contains(t.geom, k.point)
    union all
    select k.kind, c.geoid, 'county' from kept k join counties c on ST_Contains(c.geom, k.point)
    union all
    select k.kind, '34', 'state' from kept k
      where exists (select 1 from counties c where ST_Contains(c.geom, k.point))
),
regions as (
    select geoid, 'municipality' as level from towns
    union all select geoid, 'county' from counties
    union all select '34', 'state'
),
kinds as (
    select * from (values ('wawa'), ('quickchek'), ('starbucks'), ('dunkin'),
                          ('trader_joes'), ('whole_foods'), ('diner')) as k(kind)
),
counted as (
    select r.geoid, r.level, k.kind,
           (select count(*) from placed p where p.geoid = r.geoid and p.level = r.level
              and p.kind = k.kind) as n
    from regions r, kinds k
),
year as (select {{ var('read_years')['osm_nj'] }} as y)
select 'osm_nj' as source_id, 'osm_' || kind || '_count' as metric_id, geoid, level,
       make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       n::double as value, 'point_in_polygon' as match_method, 'places' as release_layer,
       'current' as release_vintage
from counted, year
