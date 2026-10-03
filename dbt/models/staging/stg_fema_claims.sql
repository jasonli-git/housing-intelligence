-- Flood insurance claims paid, per county, ZIP code and the state, by year of loss
-- (Milestone 40, ARCHITECTURE #302).
--
-- A claim counts when the NFIP paid anything on the building or its contents; claims
-- closed without payment are left out. Payments are as paid, in the dollars of the
-- year, never adjusted. The dataset is every NFIP claim, so a place and year with none
-- has no row, and that absence means none was paid: it is complete, not sampled.
--
-- Not per municipality. FEMA places each claim in a census block group, and 22,970 of
-- the 200,380 placed in New Jersey (11.5%) are in block groups the 2020 Census no longer
-- has — 2010's, renumbered since — so an allocation to towns would drop or misplace
-- them. County and reported ZIP code are exact; the town page shows its county's.
{{ config(materialized='table') }}

with claims as (
    select yearOfLoss as year,
           countyCode as county_geoid,
           left(reportedZipCode, 5) as zip,
           coalesce(netBuildingPaymentAmount, 0) + coalesce(netContentsPaymentAmount, 0)
               as paid
    from read_parquet('{{ var("parquet_dir") }}/fema_nfip_claims/current/claims.parquet')
    where yearOfLoss is not null
),
paid as (select * from claims where paid > 0),
counted as (
    select county_geoid as geoid, 'county' as level, 'fips' as match_method, year,
           count(*) as claims, sum(paid) as amount
    from paid where county_geoid like '34%' group by all
    union all
    select zip, 'zip', 'zcta', year, count(*), sum(paid)
    from paid where regexp_matches(zip, '^0[78][0-9]{3}$') group by all
    union all
    select '34', 'state', 'fips', year, count(*), sum(paid)
    from paid group by all
)
select 'fema_nfip_claims' as source_id, metric_id, geoid, level,
       make_date(year::int, 1, 1) as period_start,
       make_date(year::int, 12, 31) as period_end,
       value::double as value, match_method,
       'claims' as release_layer, 'current' as release_vintage
from counted
cross join lateral (
    values ('fema_flood_claims', claims::double), ('fema_flood_claims_paid', amount)
) as v(metric_id, value)
