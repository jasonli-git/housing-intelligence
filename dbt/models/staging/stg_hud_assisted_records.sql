{{ config(materialized='table') }}
with raw as (
    select *, regexp_extract(filename, '/([^/]+)\.parquet$', 1) as release_layer,
           {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/hud_assisted/*/*.parquet', filename=true)
), properties as (
    select * from raw where kind = 'hud_property'
), contracts as (
    select c.*, p.geoid as county_geoid, p.level as area_level
    from raw c join properties p
      on json_extract_string(c.payload, '$.property_id') = p.record_id
    where c.kind = 'hud_contract'
)
select 'hud_assisted' as source_id, record_id, geoid, level, kind,
       payload, snapshot::date as snapshot, release_layer, release_vintage
from properties
union all
select 'hud_assisted', record_id, county_geoid, area_level, kind,
       payload, snapshot::date, release_layer, release_vintage
from contracts
