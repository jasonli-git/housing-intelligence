-- Homes in each flood area, per municipality, county, ZIP code and the state
-- (Milestone 40, ARCHITECTURE #301): `stg_flood_blocks` summed over `stg_block_homes`.
--
-- FEMA's figures cover the state. NJDEP's tidal area covers the fourteen counties its
-- layer names, so its share is published for places inside them only: a ZIP code
-- counts when 99% of its homes are, and the state has no tidal figure, because a share
-- over every county would read the seven NJDEP did not map as dry.
--
-- FEMA's zone shares are published only where its digital map determines a zone for
-- 95% of homes. Most of Morris County has no digital map in the national layer (two
-- towns' community maps are in it; 14.6% of the county's homes are covered), and
-- Atlantic is at 53%: a share over homes the map does not reach would read as 0% and
-- rank those towns safest. The coverage share is always published, so the page can say
-- why the others are missing.
--
-- Dated by the year each layer was read: a flood map has no period of its own.
{{ config(materialized='table') }}

with tidal_counties(county_geoid) as (
    values ('34001'), ('34003'), ('34005'), ('34007'), ('34009'), ('34011'), ('34013'),
           ('34017'), ('34021'), ('34023'), ('34025'), ('34029'), ('34033'), ('34039')
),
blocks as (
    select h.municipality_geoid, h.county_geoid, h.zcta_geoid, h.homes,
           f.high, f.moderate, f.mapped, f.tidal,
           h.county_geoid in (select county_geoid from tidal_counties) as tidal_mapped
    from {{ ref('stg_block_homes') }} h
    join {{ ref('stg_flood_blocks') }} f using (block_geoid)
),
places as (
    select municipality_geoid as geoid, 'municipality' as level, * exclude
           (municipality_geoid, county_geoid, zcta_geoid) from blocks
    union all
    select county_geoid, 'county', * exclude
           (municipality_geoid, county_geoid, zcta_geoid) from blocks
    union all
    select zcta_geoid, 'zip', * exclude
           (municipality_geoid, county_geoid, zcta_geoid) from blocks
    union all
    select '34', 'state', * exclude
           (municipality_geoid, county_geoid, zcta_geoid) from blocks
),
summed as (
    select geoid, level,
           sum(homes * high) as high_homes,
           sum(homes * high) / sum(homes) as high,
           sum(homes * moderate) / sum(homes) as moderate,
           sum(homes * mapped) / sum(homes) as mapped,
           sum(homes * tidal) / sum(homes) as tidal,
           sum(homes) filter (where tidal_mapped) / sum(homes) as tidal_covered
    from places group by all
),
years as (
    select {{ var('read_years')['fema_nfhl'] }} as fema,
           {{ var('read_years')['njdep_cafe'] }} as njdep
),
long as (
    select 'fema_nfhl' as source_id, 'zones' as release_layer, metric_id, geoid, level,
           years.fema as y, value
    from summed, years,
         lateral (values ('fema_flood_homes_share', high),
                         ('fema_flood_homes_share_moderate', moderate),
                         ('fema_flood_homes', round(high_homes)),
                         ('fema_mapped_homes_share', mapped)) as v(metric_id, value)
    where metric_id = 'fema_mapped_homes_share' or mapped >= 0.95
    union all
    select 'njdep_cafe', 'tidal', 'njdep_tidal_homes_share', geoid, level, years.njdep,
           tidal
    from summed, years
    where level <> 'state' and tidal_covered >= 0.99
)
select source_id, metric_id, geoid, level,
       make_date(y, 1, 1) as period_start, make_date(y, 12, 31) as period_end,
       value::double as value, 'block_overlay' as match_method, release_layer,
       'current' as release_vintage
from long
