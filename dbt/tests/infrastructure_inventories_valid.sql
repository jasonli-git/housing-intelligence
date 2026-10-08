-- These are ancillary records, not metric observations: explicit inventory guards
-- stop a refresh with impossible counts, duplicate identities or missing citation keys.
with records as (
{% for source in ['eia861','doe_lead','njdep_lead_lines','epa_ucmr5','njdep_utility_areas','nj_bpu_reliability','nj_bpu_reports'] %}
    select source_id, kind, entity_id, record_id, payload::json as payload,
           release_layer, release_vintage from {{ ref('stg_' ~ source ~ '_records') }}
    {% if not loop.last %}union all{% endif %}
{% endfor %}
), bad as (
    select source_id, kind, entity_id, record_id from records
    where entity_id is null or record_id is null or release_layer is null or release_vintage is null
       or (kind = 'utility_area' and (json_extract(payload, '$.approximate_share')::double < 0
           or json_extract(payload, '$.approximate_share')::double > 1.000001))
       or (kind = 'pfas_samples' and (json_extract(payload, '$.detections')::int < 0
           or json_extract(payload, '$.detections')::int > json_extract(payload, '$.samples')::int
           or json_extract(payload, '$.minimum_reporting_limit_ng_l')::double <= 0))
       or (kind = 'lead_inventory' and (
           json_extract(payload, '$.lead')::int < 0 or json_extract(payload, '$.galvanized')::int < 0
           or json_extract(payload, '$.unknown')::int < 0 or json_extract(payload, '$.non_lead')::int < 0))
    union all
    select source_id, kind, entity_id, record_id from records
    group by 1,2,3,4 having count(*) <> 1
)
select * from bad
