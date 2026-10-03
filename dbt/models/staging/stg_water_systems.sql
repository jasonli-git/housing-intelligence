-- The community water systems serving each municipality and ZIP code, with their
-- health-based violations over the five years before the year read (Milestone 40,
-- ARCHITECTURE #304). Feeds the `water_systems` table behind each page's list, not the
-- observations.
--
-- A system is listed for a place when its retail area holds at least 1% of the place's
-- homes, or 50 of them, so a sliver of a neighbour's area across a town line does not
-- read as a supplier. The homes figure is an estimate (`stg_block_homes`).
--
-- A violation counts when it is health-based (a contaminant over its limit, or treatment
-- not done) and its compliance period began in the five calendar years before the year
-- read. Codes are named by EPA's own reference file; a contaminant code EPA does not
-- name falls back to its rule family's name.
{{ config(materialized='table') }}

with window_years as (
    select {{ var('read_years')['epa_sdwis'] }} - 5 as first_year,
           {{ var('read_years')['epa_sdwis'] }} - 1 as last_year
),
codes as (
    select value_type, value_code, value_description
    from read_parquet('{{ var("parquet_dir") }}/epa_sdwis/current/codes.parquet')
),
violations as (
    select v.pwsid,
           v.violation_id,
           v.compl_per_begin_date::date as began,
           coalesce(c.value_description, f.value_description, 'Other') as what
    from read_parquet('{{ var("parquet_dir") }}/epa_sdwis/current/violations.parquet') v
    cross join window_years w
    left join codes c
      on c.value_type = 'CONTAMINANT_CODE' and c.value_code = v.contaminant_code
    left join codes f
      on f.value_type = 'RULE_FAMILY_CODE' and f.value_code = v.rule_family_code
    where v.pws_type_code = 'CWS'
      and year(v.compl_per_begin_date::date) between w.first_year and w.last_year
),
by_system as (
    select pwsid,
           count(distinct violation_id) as violations,
           max(began) as latest,
           arg_max(what, began) as latest_what,
           string_agg(distinct what, '; ' order by what) as kinds
    from violations
    group by 1
),
served as (
    select h.municipality_geoid, h.zcta_geoid, w.pwsid, w.system_name,
           h.homes * w.share as homes
    from {{ ref('stg_water_blocks') }} w
    join {{ ref('stg_block_homes') }} h using (block_geoid)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, pwsid,
           any_value(system_name) as system_name, sum(homes) as homes
    from served group by 1, 2, 3
    union all
    select zcta_geoid, 'zip', pwsid, any_value(system_name), sum(homes)
    from served group by 1, 2, 3
),
totals as (
    select municipality_geoid as geoid, 'municipality' as level, sum(homes) as homes
    from {{ ref('stg_block_homes') }} group by 1
    union all
    select zcta_geoid, 'zip', sum(homes) from {{ ref('stg_block_homes') }} group by 1
)
select p.geoid, p.level, p.pwsid, p.system_name,
       round(p.homes) as homes,
       p.homes / t.homes as share_of_homes,
       coalesce(s.violations, 0) as violations,
       s.latest as latest_violation,
       s.latest_what as latest_violation_what,
       s.kinds as violation_kinds,
       w.first_year, w.last_year,
       'current' as release_vintage
from places p
join totals t using (geoid, level)
cross join window_years w
left join by_system s on s.pwsid = p.pwsid
where p.homes / t.homes >= 0.01 or p.homes >= 50
