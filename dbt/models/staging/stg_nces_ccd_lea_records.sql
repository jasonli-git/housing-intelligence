-- NCES's school district directory (#356): each New Jersey district's status, so a
-- district NJDOE publishes no results for reads as running no schools, or as closed
-- into its successor, rather than as a blank.
{{ config(materialized='table') }}
with files as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/nces_ccd_lea/*/districts_*.parquet', filename=true)
), stamps as (
    select regexp_replace(filename, '\.src$', '') as filename,
           regexp_replace(content, '\s+', '', 'g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/nces_ccd_lea/*/districts_*.parquet.src')
)
select 'nces_ccd_lea' as source_id, kind, entity_id, record_id, payload,
       snapshot::date as snapshot, 'districts' as release_layer, release_vintage, file_sha256
from files left join stamps using(filename)
where release_vintage = (select max(release_vintage) from files)
