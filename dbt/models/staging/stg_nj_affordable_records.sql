{{ config(materialized='table') }}
with raw as (
    select *, regexp_extract(filename, '/([^/]+)\.parquet$', 1) as release_layer,
           {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/nj_affordable/*/*.parquet',
                      filename=true, union_by_name=true)
)
select 'nj_affordable' as source_id, r.record_id,
       coalesce(nullif(r.geoid, ''), i.geoid) as geoid,
       'municipality' as level, r.kind, r.payload, r.snapshot::date as snapshot,
       r.release_layer, r.release_vintage
from raw r
left join {{ ref('stg_nj_municipal_codes') }} i on i.identifier = r.cd_code
-- An unknown town fails the ancillary loader's validation; it is not guessed by name.
