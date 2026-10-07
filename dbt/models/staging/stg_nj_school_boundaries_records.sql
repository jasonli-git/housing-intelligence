-- Union a district's pieces before intersection. Home weights identify approximate
-- district associations, not pupils or enrollment eligibility. Keep grade types apart.
{{ config(materialized='table') }}
with pieces as (
    select 'unified' as district_type, NJDOE_ID_U as district_id, DIST_NAME as name,
           ST_MakeValid(ST_GeomFromGeoJSON(geometry)) as geom
    from read_parquet('{{ var("parquet_dir") }}/nj_school_boundaries/current/unified.parquet')
    union all
    select 'elementary', NJDOE_ID_E, DIST_NAME, ST_MakeValid(ST_GeomFromGeoJSON(geometry))
    from read_parquet('{{ var("parquet_dir") }}/nj_school_boundaries/current/elementary.parquet')
    union all
    select 'secondary', NJDOE_ID_S, DIST_NAME, ST_MakeValid(ST_GeomFromGeoJSON(geometry))
    from read_parquet('{{ var("parquet_dir") }}/nj_school_boundaries/current/secondary.parquet')
), stamps as (
    select regexp_extract(filename, '/([^/]+)\.parquet.src$', 1) as district_type,
           regexp_replace(content, '\s+', '', 'g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/nj_school_boundaries/current/*.parquet.src')
), areas as (
    select district_type, district_id, name, file_sha256, ST_Union_Agg(geom) as geom
    from pieces left join stamps using(district_type)
    where district_id is not null and regexp_full_match(district_id, '[0-9]{2}-[0-9]{4}')
    group by 1,2,3,4
), covered as (
    select h.*, a.district_type, a.district_id, a.name, a.file_sha256,
           least(1.0, ST_Area(ST_Intersection(h.geom,a.geom))/ST_Area(h.geom)) as covered
    from {{ ref('stg_block_homes') }} h join areas a on ST_Intersects(h.geom,a.geom)
), places as (
    select 'municipality:' || municipality_geoid as entity_id, district_type, district_id, name, file_sha256, sum(homes*covered) as homes
    from covered where municipality_geoid is not null group by 1,2,3,4,5
    union all
    select 'county:' || county_geoid, district_type, district_id, name, file_sha256, sum(homes*covered) from covered group by 1,2,3,4,5
    union all
    select 'zip:' || zcta_geoid, district_type, district_id, name, file_sha256, sum(homes*covered) from covered where zcta_geoid is not null group by 1,2,3,4,5
), totals as (
    select 'municipality:' || municipality_geoid as entity_id, sum(homes) as homes from {{ ref('stg_block_homes') }} group by 1
    union all
    select 'county:' || county_geoid, sum(homes) from {{ ref('stg_block_homes') }} group by 1
    union all
    select 'zip:' || zcta_geoid, sum(homes) from {{ ref('stg_block_homes') }} group by 1
)
select 'nj_school_boundaries' as source_id, 'school_area' as kind, p.entity_id,
       district_type || ':' || district_id as record_id,
       to_json(struct_pack(district_id := district_id, name := name, district_type := district_type,
           approximate_share := least(1.0,p.homes/t.homes))) as payload,
       null::date as snapshot, district_type as release_layer, 'current' as release_vintage, file_sha256
from places p join totals t using(entity_id)
where p.homes > 0 and (p.homes/t.homes >= 0.01 or p.homes >= 50)
