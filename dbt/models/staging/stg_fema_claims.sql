-- Flood insurance claims paid, per county, ZIP code, town and the state, by year of loss
-- (Milestone 40, ARCHITECTURE #302; towns since #354).
--
-- A claim counts when the NFIP paid anything on the building or its contents; claims
-- closed without payment are left out. Payments are as paid, in the dollars of the
-- year, never adjusted. The dataset is every NFIP claim, so a place and year with none
-- has no row, and that absence means none was paid: it is complete, not sampled.
--
-- County and reported ZIP code are exact. A town's are estimated (#354): FEMA places
-- each claim in a census block group without saying which census's, so a block group's
-- claims are shared among towns by where its homes are — its 2020 blocks' homes for a
-- code the 2020 Census has, the homes of the 2020 blocks a 2010 block group's land
-- became for a code only 2010 had (`census_block_rel`). A code both censuses use, for
-- areas that place its homes in different towns, cannot be read either way: those
-- claims are not placed, and each town they could belong to counts them in
-- `fema_flood_claims_unplaced`, the most its figure could be short by.
{{ config(materialized='table') }}

-- Below this share of homes placed differently, a code both censuses use reads the
-- same either way, and the 2020 reading is taken.
{% set same_either_way = 0.1 %}

with claims as (
    select yearOfLoss as year,
           countyCode as county_geoid,
           left(reportedZipCode, 5) as zip,
           left(censusGeoid, 12) as block_group,
           coalesce(netBuildingPaymentAmount, 0) + coalesce(netContentsPaymentAmount, 0)
               as paid
    from read_parquet('{{ var("parquet_dir") }}/fema_nfip_claims/current/claims.parquet')
    where yearOfLoss is not null
),
paid as (select * from claims where paid > 0),
homes as (
    select block_geoid, municipality_geoid as town, homes::double as homes
    from {{ ref('stg_block_homes') }}
    where municipality_geoid is not null
),
-- A 2020 block group's homes by town.
in_2020 as (
    select left(block_geoid, 12) as block_group, town,
           sum(homes) / sum(sum(homes)) over (partition by left(block_geoid, 12)) as weight
    from homes group by 1, 2
),
-- A 2010 block group's homes by town: each 2020 block's homes, in the share of its land
-- the 2010 block group's blocks overlap.
relationship as (
    select block_2010, block_2020, land_2020::double as land_2020,
           land_shared::double as land_shared
    from read_parquet('{{ var("parquet_dir") }}/census_block_rel/*/*.parquet')
),
in_2010 as (
    select left(r.block_2010, 12) as block_group, h.town,
           sum(h.homes * r.land_shared / r.land_2020)
               / sum(sum(h.homes * r.land_shared / r.land_2020))
                   over (partition by left(r.block_2010, 12)) as weight
    from relationship r
    join homes h on h.block_geoid = r.block_2020
    -- Within its own county: a 2010 block can touch a 2020 block across a county line
    -- that moved by a few metres, and a claim is never placed outside FEMA's county.
    where r.land_2020 > 0 and left(h.town, 5) = left(r.block_2010, 5)
    group by 1, 2
),
-- How differently the two readings of a code both censuses use place its homes: half
-- the summed difference in town shares, 0 for the same towns, 1 for none in common.
both_readings as (
    select block_group,
           0.5 * sum(abs(coalesce(n.weight, 0) - coalesce(o.weight, 0))) as moved
    from in_2020 n full join in_2010 o using (block_group, town)
    where block_group in (select block_group from in_2020)
      and block_group in (select block_group from in_2010)
    group by all
),
placed as (
    select block_group, town, weight from in_2020
    where block_group not in (select block_group from in_2010)
    union all
    select block_group, town, weight from in_2010
    where block_group not in (select block_group from in_2020)
    union all
    select n.block_group, n.town, n.weight
    from in_2020 n join both_readings b using (block_group)
    where b.moved < {{ same_either_way }}
),
ambiguous as (
    select distinct block_group, town from (
        select block_group, town from in_2020 union all select block_group, town from in_2010
    ) both_towns
    join both_readings b using (block_group)
    where b.moved >= {{ same_either_way }}
),
counted as (
    select county_geoid as geoid, 'county' as level, 'fips' as match_method, year,
           count(*)::double as claims, sum(paid) as amount, null::double as unplaced
    from paid where county_geoid like '34%' group by all
    union all
    select zip, 'zip', 'zcta', year, count(*), sum(paid), null
    from paid where regexp_matches(zip, '^0[78][0-9]{3}$') group by all
    union all
    select '34', 'state', 'fips', year, count(*), sum(paid), null
    from paid group by all
    union all
    select p.town, 'municipality', 'block_crosswalk', c.year,
           sum(p.weight), sum(c.paid * p.weight), null
    from paid c join placed p using (block_group)
    -- 150 claims name a county other than their block group's. FEMA's county is the
    -- one the county figure counts, so a claim the two disagree on is not placed.
    where left(c.block_group, 5) = c.county_geoid
    group by all
),
unplaced as (
    select a.town as geoid, c.year, count(*)::double as claims
    from paid c join ambiguous a using (block_group)
    where left(c.block_group, 5) = c.county_geoid
    group by all
),
town_years as (
    -- A town with claims it might be owed but none placed still has a row, so the page
    -- can say so rather than read as none.
    select geoid, year from counted where level = 'municipality'
    union
    select geoid, year from unplaced
)
select 'fema_nfip_claims' as source_id, metric_id, geoid, level,
       make_date(year::int, 1, 1) as period_start,
       make_date(year::int, 12, 31) as period_end,
       value::double as value, match_method,
       'claims' as release_layer, 'current' as release_vintage
from counted
cross join lateral (
    values ('fema_flood_claims', claims), ('fema_flood_claims_paid', amount)
) as v(metric_id, value)
union all
select 'fema_nfip_claims', 'fema_flood_claims_unplaced', t.geoid, 'municipality',
       make_date(t.year::int, 1, 1), make_date(t.year::int, 12, 31),
       coalesce(u.claims, 0), 'block_crosswalk', 'claims', 'current'
from town_years t left join unplaced u using (geoid, year)
