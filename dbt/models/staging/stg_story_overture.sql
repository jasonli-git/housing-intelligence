-- Chains, diners, bagel shops and pizzerias in each town, from Overture Maps Places
-- (Milestone 60): the Starbucks index and the pizza–bagel line. The Wawa line and Diner
-- capital read the OpenStreetMap counts (stg_story_osm) as before.
--
-- A chain is matched on Overture's brand, a kind of restaurant on its primary category.
-- Overture merges several providers, so a shop can be listed twice: places of one kind
-- within 150 metres of another with a smaller id are dropped, as for OpenStreetMap.
-- Places marked permanently closed are dropped. No confidence floor: with duplicates
-- merged and only points inside New Jersey's towns counted, the statewide counts sat at
-- or below outside store counts at every floor tried (2026-11-03), and a floor only
-- removed real shops. A place whose only provider is All the Places, scraped from chains'
-- own store locators under a licence those sites never granted, is dropped (ARCHITECTURE
-- #271, owner 2026-11-03): about 32 QuickChek, 33 Dunkin' and 9 Wawa stores no other
-- provider lists, so those counts are a floor.
{{ config(materialized='table') }}

with raw as (
    select id, brand, category, ST_Point(lon, lat) as point
    from read_parquet('{{ var("parquet_dir") }}/overture_places/current/places.parquet')
    where coalesce(operating_status, 'open') <> 'permanently_closed'
      -- Overture's own labels ride along with every provider's.
      and list_filter(datasets, d -> d not in ('Overture', 'Overture-signals'))
          <> ['AllThePlaces']
),
labelled as (
    select id, point,
           case
               when brand = 'Wawa' then 'wawa'
               when brand = 'QuickChek' then 'quickchek'
               when brand = 'Starbucks' then 'starbucks'
               when brand = 'Dunkin''' then 'dunkin'
               when brand = 'Trader Joe''s' then 'trader_joes'
               when brand = 'Whole Foods Market' then 'whole_foods'
               when category = 'diner' then 'diner'
               when category = 'bagel_shop' then 'bagel'
               when category = 'pizza_restaurant' then 'pizza'
           end as kind
    from raw
),
kept as (
    select l.* from labelled l
    where l.kind is not null
      and not exists (
          select 1 from labelled o
          where o.kind = l.kind and o.id < l.id
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
                          ('trader_joes'), ('whole_foods'), ('diner'), ('bagel'),
                          ('pizza')) as k(kind)
),
counted as (
    select r.geoid, r.level, k.kind,
           (select count(*) from placed p where p.geoid = r.geoid and p.level = r.level
              and p.kind = k.kind) as n
    from regions r, kinds k
),
year as (select {{ var('read_years')['overture_places'] }} as y)
select 'overture_places' as source_id, 'overture_' || kind || '_count' as metric_id,
       geoid, level, make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       n::double as value, 'point_in_polygon' as match_method, 'places' as release_layer,
       'current' as release_vintage
from counted, year
