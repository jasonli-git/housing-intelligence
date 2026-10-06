-- Where each place's residents work, as a short list (Milestone 45, ARCHITECTURE #313):
-- the ten destinations holding the most of their jobs, from `stg_lodes_jobs`.
--
-- A destination in New Jersey is a municipality, linked to its page. Out of state, New
-- York City's five boroughs are one destination and Philadelphia another; the rest of
-- New York and Pennsylvania, and Delaware and Connecticut, are each one; every other
-- state is "Other states". A destination with fewer than 20 jobs is not listed: LODES
-- adds noise for privacy, and at that size the noise is most of the figure.
{{ config(materialized='table') }}

with jobs as (
    select j.*,
           case
               when j.work_state = '34' then j.work_town
               else null
           end as destination_geoid,
           case
               when j.work_state = '34' then null
               when j.work_county in ('36005', '36047', '36061', '36081', '36085')
                   then 'New York City'
               when j.work_county = '42101' then 'Philadelphia'
               when j.work_state = '36' then 'Elsewhere in New York'
               when j.work_state = '42' then 'Elsewhere in Pennsylvania'
               when j.work_state = '10' then 'Delaware'
               when j.work_state = '09' then 'Connecticut'
               else 'Other states'
           end as destination_name
    from {{ ref('stg_lodes_jobs') }} j
),
places as (
    select home_town as geoid, 'municipality' as level, * from jobs
    union all select home_county, 'county', * from jobs
    union all select home_zcta, 'zip', * from jobs where home_zcta is not null
    union all select '34', 'state', * from jobs
),
totals as (
    select geoid, level, sum(jobs) as total from places group by 1, 2
),
flows as (
    select geoid, level, destination_geoid, destination_name,
           any_value(year) as year, sum(jobs) as jobs
    from places group by 1, 2, 3, 4
),
ranked as (
    select f.*, t.total,
           row_number() over (
               partition by f.geoid, f.level
               order by f.jobs desc, f.destination_geoid, f.destination_name
           ) as rank
    from flows f join totals t using (geoid, level)
    -- As `stg_work_flows`: no list for a place whose residents hold under 100 jobs.
    where f.jobs >= 20 and t.total >= 100
)
select geoid, level, rank::smallint as rank, destination_geoid, destination_name,
       jobs, jobs / total as share, total as total_jobs, year,
       year::varchar as release_vintage
from ranked
where rank <= 10
