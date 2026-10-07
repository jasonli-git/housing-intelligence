{{ config(materialized='table') }}
with files as (
    select * from read_parquet('{{ var("parquet_dir") }}/cdc_places/current/*.parquet', filename=true)
), stamps as (
    select regexp_replace(filename, '\.src$', '') as filename,
           regexp_replace(content, '\s+', '', 'g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/cdc_places/current/*.parquet.src')
)
select 'cdc_places' as source_id, kind, entity_id, record_id, payload,
       snapshot::date as snapshot,
       regexp_extract(filename, '/([^/]+)\.parquet$', 1) as release_layer,
       'current' as release_vintage, file_sha256
from files left join stamps using(filename)
