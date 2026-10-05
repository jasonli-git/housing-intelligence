-- Coarse NJDEP territory polygons laid over home-bearing Census blocks. These
-- associations identify providers around a place, not the supplier at an address.
-- Union each provider's pieces FIRST: overlapping multipart polygons must not
-- count the same block area twice. Provider shares are never a market share.
{{ config(materialized='table') }}
with pieces as (
    select 'electric' as fuel, trim(NAME) as provider, ST_MakeValid(ST_GeomFromGeoJSON(geometry)) as geom
    from read_parquet('{{ var("parquet_dir") }}/njdep_utility_areas/current/electric.parquet')
    where trim(NAME) <> '' and geometry is not null
    union all
    select 'gas', trim(NAME), ST_MakeValid(ST_GeomFromGeoJSON(geometry))
    from read_parquet('{{ var("parquet_dir") }}/njdep_utility_areas/current/gas.parquet')
    where trim(NAME) <> '' and geometry is not null
), areas as (
    select fuel, provider, ST_Union_Agg(geom) as geom from pieces group by 1, 2
), covered as (
    select h.*, a.fuel, a.provider,
           least(1.0, ST_Area(ST_Intersection(h.geom, a.geom)) / ST_Area(h.geom)) as covered
    from {{ ref('stg_block_homes') }} h join areas a on ST_Intersects(h.geom, a.geom)
), places as (
    select 'municipality:' || municipality_geoid as entity_id, fuel, provider, sum(homes * covered) as homes
    from covered where municipality_geoid is not null group by 1, 2, 3
    union all
    select 'county:' || county_geoid, fuel, provider, sum(homes * covered) from covered group by 1, 2, 3
    union all
    select 'zip:' || zcta_geoid, fuel, provider, sum(homes * covered) from covered where zcta_geoid is not null group by 1, 2, 3
    union all
    select 'state:34', fuel, provider, sum(homes * covered) from covered group by 1, 2, 3
), totals as (
    select 'municipality:' || municipality_geoid as entity_id, sum(homes) as homes from {{ ref('stg_block_homes') }} group by 1
    union all
    select 'county:' || county_geoid, sum(homes) from {{ ref('stg_block_homes') }} group by 1
    union all
    select 'zip:' || zcta_geoid, sum(homes) from {{ ref('stg_block_homes') }} group by 1
    union all
    select 'state:34', sum(homes) from {{ ref('stg_block_homes') }}
)
select 'njdep_utility_areas' as source_id, 'utility_area' as kind, p.entity_id,
       p.fuel || ':' || p.provider as record_id,
       to_json(struct_pack(fuel := p.fuel, provider := p.provider,
           approximate_share := p.homes / t.homes,
           eia_id := case p.provider when 'Atlantic City Electric' then '963'
               when 'Jersey Central Power & Light' then '9726'
               when 'Public Service Electric & Gas Co.' then '15477'
               when 'Rockland Electric Company' then '16213' end)) as payload,
       null::date as snapshot, p.fuel as release_layer, 'current' as release_vintage
from places p join totals t using (entity_id)
where p.homes / t.homes >= 0.01 or p.homes >= 50
