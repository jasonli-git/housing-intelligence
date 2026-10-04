{{ config(materialized='table') }}
select 'doe_lead' as source_id, 'energy_burden' as kind,
       'county:' || geoid as entity_id, geoid as record_id,
       payload, date '2022-12-31' as snapshot,
       'counties' as release_layer, '2022' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/doe_lead/2022/counties.parquet')
