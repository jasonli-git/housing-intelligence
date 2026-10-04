{{ config(materialized='table') }}
with municipal as (
    select geoid, snapshot, release_layer, release_vintage,
           'nj_ah_present_need' as metric_id,
           json_extract(payload, '$.present_need')::double as value
    from {{ ref('stg_nj_affordable_records') }} where kind = 'need'
    union all
    select geoid, snapshot, release_layer, release_vintage, 'nj_ah_prospective_need',
           json_extract(payload, '$.prospective_need')::double
    from {{ ref('stg_nj_affordable_records') }} where kind = 'need'
    union all
    select geoid, snapshot, release_layer, release_vintage, 'nj_ah_trust_balance',
           json_extract(payload, '$.balance')::double
    from {{ ref('stg_nj_affordable_records') }}
    where kind = 'trust_fund' and json_extract(payload, '$.reported')::boolean
    union all
    select geoid, snapshot, release_layer, release_vintage,
           'nj_ah_completed_units',
           sum(case when json_extract(payload, '$.completed_for_summary')::boolean
                    then json_extract(payload, '$.units')::double end)
    from {{ ref('stg_nj_affordable_records') }} where kind = 'municipal_project'
    group by 1, 2, 3, 4
), expanded as (
    select m.*, g.area_geoid, g.area_level
    from municipal m, lateral (values (m.geoid, 'municipality'),
        (left(m.geoid, 5), 'county'), ('34', 'state')) g(area_geoid, area_level)
)
select 'nj_affordable' as source_id, metric_id, area_geoid as geoid,
       area_level as level, snapshot as period_start, snapshot as period_end,
       sum(value) as value, 'identifier' as match_method,
       release_layer as release_layer, release_vintage
from expanded where value is not null
group by metric_id, area_geoid, area_level, snapshot, release_layer, release_vintage
