{{ config(materialized='table') }}
select 'doe_lead' as source_id, 'energy_burden' as kind,
       'county:' || geoid as entity_id, geoid as record_id,
       payload, date '2022-12-31' as snapshot,
       regexp_extract(filename, '/(counties[a-z_]*)\.parquet$', 1) as release_layer,
       '2022' as release_vintage
-- One file per state (Milestone 63); New Jersey's is `counties`, Pennsylvania's
-- `counties_pa`.
from read_parquet('{{ var("parquet_dir") }}/doe_lead/2022/counties*.parquet', filename = true)
