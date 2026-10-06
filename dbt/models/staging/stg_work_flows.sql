-- Where residents work, as shares of their jobs, per municipality, county, ZIP code and
-- the state (Milestone 45, ARCHITECTURE #313), from `stg_lodes_jobs`.
--
-- Five shares that add to one: the home county, elsewhere in New Jersey, New York City,
-- Pennsylvania, and every other state; and for a municipality, its own town besides,
-- which the home county's share includes. A share of jobs, not of workers: a person with
-- two jobs counts twice (JT00). Cited to New Jersey's main file, which holds 83% of the
-- jobs; the auxiliary files are listed with the source.
--
-- The count is always published; the shares only where residents hold at least 100
-- jobs. Pine Valley's residents hold one, and a share of one noisy job is not a
-- finding (LODES adds noise for privacy).
{{ config(materialized='table') }}

with nyc(county) as (
    values ('36005'), ('36047'), ('36061'), ('36081'), ('36085')
),
jobs as (
    select j.*, j.work_county in (select county from nyc) as in_nyc
    from {{ ref('stg_lodes_jobs') }} j
),
places as (
    select home_town as geoid, 'municipality' as level, * from jobs
    union all select home_county, 'county', * from jobs
    union all select home_zcta, 'zip', * from jobs where home_zcta is not null
    union all select '34', 'state', * from jobs
),
summed as (
    select geoid, level, any_value(year) as year,
           sum(jobs) as total,
           sum(jobs) filter (where work_town = home_town) as same_town,
           sum(jobs) filter (where work_county = home_county) as home_county,
           sum(jobs) filter (where work_state = '34' and work_county <> home_county)
               as other_nj,
           sum(jobs) filter (where in_nyc) as nyc,
           sum(jobs) filter (where work_state = '42') as pennsylvania,
           sum(jobs) filter (where work_state not in ('34', '42') and not in_nyc)
               as other_state
    from places group by 1, 2
),
long as (
    select geoid, level, year, metric_id, value
    from summed,
         lateral (values
             ('lodes_resident_jobs', total::double),
             ('lodes_work_same_town_share', coalesce(same_town, 0) / total),
             ('lodes_work_home_county_share', coalesce(home_county, 0) / total),
             ('lodes_work_other_nj_share', coalesce(other_nj, 0) / total),
             ('lodes_work_nyc_share', coalesce(nyc, 0) / total),
             ('lodes_work_pennsylvania_share', coalesce(pennsylvania, 0) / total),
             ('lodes_work_other_state_share', coalesce(other_state, 0) / total)
         ) as v(metric_id, value)
    where total > 0
      and (metric_id = 'lodes_resident_jobs' or total >= 100)
      and (metric_id <> 'lodes_work_same_town_share' or level = 'municipality')
)
select 'census_lodes' as source_id, metric_id, geoid, level,
       make_date(year, 1, 1) as period_start, make_date(year, 12, 31) as period_end,
       value, 'block_crosswalk' as match_method, 'od_main' as release_layer,
       year::varchar as release_vintage
from long
