{{ config(materialized='table') }}
with files as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/fcc_bdc/*/summary.parquet', filename=true)
), stamps as (
    select regexp_replace(filename, '\.src$', '') as filename,
           regexp_replace(content, '\s+', '', 'g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/fcc_bdc/*/summary.parquet.src')
)
select 'fcc_bdc' as source_id, kind, entity_id, record_id, payload,
       snapshot::date as snapshot, 'summary' as release_layer, release_vintage, file_sha256
from files left join stamps using(filename)
where release_vintage = (select max(release_vintage) from files)
