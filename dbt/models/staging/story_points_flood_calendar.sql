-- Every day's flood insurance claims paid in New Jersey since 1978 (the visual stories,
-- 2026-10-23): one row a day with any, for the calendar. A claim counts as in
-- `stg_fema_claims`, when anything was paid; dated by its day of loss.
{{ config(materialized='table') }}

select 'flood-claims-calendar' as story_id, 'claims' as series,
       null::varchar as geoid, null::varchar as level,
       strftime(cast(dateOfLoss as date), '%Y-%m-%d') as x, count(*)::double as y,
       null::varchar as label,
       'fema_nfip_claims' as source_id, 'claims' as layer, 'current' as vintage
from read_parquet('{{ var("parquet_dir") }}/fema_nfip_claims/current/claims.parquet')
where dateOfLoss is not null
  and coalesce(netBuildingPaymentAmount, 0) + coalesce(netContentsPaymentAmount, 0) > 0
group by 5
