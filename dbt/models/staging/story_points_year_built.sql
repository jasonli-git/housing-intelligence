-- When each county's houses were built, by decade (the visual stories, 2026-10-23): the
-- one-to-four-family parcels (class 2) of MOD-IV with a year of construction, counted
-- by decade, for the ridgeline. Assessors record a year for most houses but not all,
-- and an old house's is often an estimate; a year before 1700 is left out as unknown.
{{ config(materialized='table') }}

with parcels as (
    select '34' || lpad((2 * substr(CD_CODE, 1, 2)::int - 1)::varchar, 3, '0') as county,
           (YR_CONSTR // 10) * 10 as decade
    from read_parquet('{{ var("parquet_dir") }}/nj_modiv/*/statewide.parquet')
    where PROP_CLASS = '2' and YR_CONSTR between 1700 and 2026
      and CD_CODE is not null and CD_CODE <> ''
),
placed as (
    select county as geoid, 'county' as level, decade from parcels
    union all select '34', 'state', decade from parcels
)
select 'when-the-town-was-built' as story_id, 'homes' as series, geoid, level,
       decade::varchar as x, count(*)::double as y, null::varchar as label,
       'nj_modiv' as source_id, 'statewide' as layer, 'current' as vintage
from placed group by geoid, level, decade
