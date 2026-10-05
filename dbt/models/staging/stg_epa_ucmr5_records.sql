{{ config(materialized='table') }}
with raw as (
    select distinct pwsid, sample_id, facility_id, sample_point, method_id,
           contaminant, collected::date as collected, detected, ng_l, reporting_limit_ng_l
    from read_parquet('{{ var("parquet_dir") }}/epa_ucmr5/current/samples.parquet')
), analytes as (
    select pwsid, contaminant, min(collected) as first_sample, max(collected) as last_sample,
           count(*) as samples, count(*) filter (where detected) as detections,
           max(ng_l) as maximum_ng_l, min(reporting_limit_ng_l) as minimum_reporting_limit_ng_l,
           max(reporting_limit_ng_l) as maximum_reporting_limit_ng_l,
           case when contaminant in ('PFOA', 'PFOS') then 4.0 end as reference_ng_l,
           count(*) filter (where contaminant in ('PFOA', 'PFOS') and ng_l > 4.0) as samples_above_reference
    from raw group by 1, 2
)
select 'epa_ucmr5' as source_id, 'pfas_samples' as kind,
       'pwsid:' || pwsid as entity_id, contaminant as record_id,
       to_json(struct_pack(contaminant := contaminant, first_sample := first_sample,
           last_sample := last_sample, samples := samples, detections := detections,
           maximum_ng_l := maximum_ng_l,
           minimum_reporting_limit_ng_l := minimum_reporting_limit_ng_l,
           maximum_reporting_limit_ng_l := maximum_reporting_limit_ng_l,
           reference_ng_l := reference_ng_l, samples_above_reference := samples_above_reference)) as payload,
       last_sample as snapshot, 'samples' as release_layer, 'current' as release_vintage
from analytes
