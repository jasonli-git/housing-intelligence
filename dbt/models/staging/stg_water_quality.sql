-- Two shares of homes per municipality, county, ZIP code and the state (Milestone 40,
-- ARCHITECTURE #304):
--   `water_homes_share_public`    — in a community water system's retail area, so on
--                                   public water; most of the rest are on private wells;
--   `water_homes_share_violation` — in the area of a system with a health-based
--                                   violation whose period began in the five calendar
--                                   years before the year read.
-- Estimates over 2020's homes (`stg_block_homes`). A share of homes, never a score: a
-- violation is a period the water broke a rule, not a measure of the water today.
{{ config(materialized='table') }}

with window_years as (
    select {{ var('read_years')['epa_sdwis'] }} - 5 as first_year,
           {{ var('read_years')['epa_sdwis'] }} - 1 as last_year
),
violating as (
    select distinct v.pwsid
    from read_parquet('{{ var("parquet_dir") }}/epa_sdwis/current/violations.parquet') v
    cross join window_years w
    where v.pws_type_code = 'CWS'
      and year(v.compl_per_begin_date::date) between w.first_year and w.last_year
),
blocks as (
    select h.block_geoid, h.county_geoid, h.municipality_geoid, h.zcta_geoid, h.homes,
           least(1.0, coalesce(sum(w.share), 0)) as public,
           least(1.0, coalesce(sum(w.share) filter (where x.pwsid is not null), 0))
               as violation
    from {{ ref('stg_block_homes') }} h
    left join {{ ref('stg_water_blocks') }} w using (block_geoid)
    left join violating x on x.pwsid = w.pwsid
    group by all
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, homes, public, violation
    from blocks
    union all
    select county_geoid, 'county', homes, public, violation from blocks
    union all
    select zcta_geoid, 'zip', homes, public, violation from blocks
    union all
    select '34', 'state', homes, public, violation from blocks
),
shares as (
    select geoid, level,
           sum(homes * public) / sum(homes) as public,
           sum(homes * violation) / sum(homes) as violation
    from places group by all
)
select source_id, metric_id, geoid, level,
       make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       value, 'block_overlay' as match_method, release_layer,
       'current' as release_vintage
from shares
cross join lateral (
    values ('njdep_water_areas', 'water_homes_share_public', public, 'areas',
            {{ var('read_years')['njdep_water_areas'] }}),
           ('epa_sdwis', 'water_homes_share_violation', violation, 'violations',
            {{ var('read_years')['epa_sdwis'] }})
) as v(source_id, metric_id, value, release_layer, y)
