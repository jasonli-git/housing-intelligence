{{ config(materialized='table') }}
-- Each system's 2025 and 2026 service-line inventory, from NJDEP's answer to OPRA
-- request 407131 (ARCHITECTURE #409). One record per system and submission year; the
-- API shows each system its newest across this and the public layer's 2024 submission.
select 'njdep_lead_lines_opra' as source_id, 'lead_inventory' as kind,
       'pwsid:' || pwsid as entity_id, record_id, payload,
       make_date(year::int, 12, 31) as snapshot,
       'inventory' as release_layer, '407131' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/njdep_lead_lines_opra/407131/inventory.parquet')
