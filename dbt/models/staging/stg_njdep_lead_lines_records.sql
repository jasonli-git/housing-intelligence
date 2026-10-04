{{ config(materialized='table') }}
with raw as (
    select * from read_parquet('{{ var("parquet_dir") }}/njdep_lead_lines/current/lines.parquet')
), latest as (
    select * from raw qualify row_number() over (partition by PWID
        order by SUBMISSION_YEAR desc, DATE_UPDATED desc, OBJECTID desc) = 1
)
select 'njdep_lead_lines' as source_id, 'lead_inventory' as kind,
       'pwsid:' || PWID as entity_id, PWID as record_id,
       to_json(struct_pack(name := SYS_NAME, lead := LSLI, galvanized := LSGA,
           lead_connectors := LSGO, unknown := LSUN, non_lead := LSNL,
           submission_year := SUBMISSION_YEAR, category_updated := DATE_UPDATED,
           inventory_url := SLI_ACCESS)) as payload,
       make_date(SUBMISSION_YEAR::int, 12, 31) as snapshot,
       'lines' as release_layer, 'current' as release_vintage
from latest
