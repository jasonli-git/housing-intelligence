{{ config(materialized='table') }}
select 'nj_bpu_reliability' as source_id, 'regulatory_reliability' as kind,
       'utility:' || utility_id as entity_id, record_id, payload,
       make_date(year::int, 12, 31) as snapshot,
       'jcpl_order' as release_layer, '2025' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/nj_bpu_reliability/2025/jcpl_order.parquet')
