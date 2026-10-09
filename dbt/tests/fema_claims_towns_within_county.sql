-- A county's towns can never hold more claims than the county (#354): each claim is
-- shared among towns with weights summing to one, or not placed at all.
with towns as (
    select left(geoid, 5) as county, period_end, sum(value) as claims
    from {{ ref('stg_fema_claims') }}
    where level = 'municipality' and metric_id = 'fema_flood_claims'
    group by all
)
select t.county, t.period_end, t.claims, c.value as county_claims
from towns t
join {{ ref('stg_fema_claims') }} c
  on c.geoid = t.county and c.level = 'county' and c.period_end = t.period_end
 and c.metric_id = 'fema_flood_claims'
where t.claims > c.value + 1e-6
