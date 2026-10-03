-- Known contaminated sites with remediation open, counted per municipality, county,
-- ZIP code and the state, by where each case stands (Milestone 40, ARCHITECTURE #303).
--
-- NJDEP's list holds only open cases, in four statuses, counted as three figures:
--   `Active`, `Pending`   -> remediation under way or not yet begun;
--   `Active - Post Rem`   -> cleaned up, with controls that stay (a deed notice, a
--                            ground water classification exception area);
--   `Active - UHOT`       -> a leaking home heating-oil tank, nearly always a house.
-- Counts, never ranked and never a rate: an old industrial city tops any count, which
-- says nothing about one home in it.
--
-- A site's municipality is NJDEP's own code for it (through `stg_nj_municipal_codes`);
-- its ZIP code is the ZCTA its point falls in. Dated by the year the list was read.
{{ config(materialized='table') }}

with sites as (
    select OBJECTID as site,
           case when STATUS in ('Active', 'Pending') then 'njdep_sites_open'
                when STATUS = 'Active - Post Rem' then 'njdep_sites_post_remedy'
                when STATUS = 'Active - UHOT' then 'njdep_sites_heating_oil'
           end as metric_id,
           COMU_CODE as cd_code,
           ST_GeomFromGeoJSON(geometry) as point
    from read_parquet('{{ var("parquet_dir") }}/njdep_kcsl/current/sites.parquet')
),
zctas as (
    select GEOID20 as geoid, ST_GeomFromWKB(geom_wkb) as geom
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/zcta.parquet')
    where left(GEOID20, 2) in ('07', '08')
),
-- An inner spatial join, keyed back by site: DuckDB 1.5's spatial join emitted a
-- matched site a second time as unmatched under a LEFT join, adding ~2% at random.
site_zcta as (
    select s.site, z.geoid
    from sites s
    join zctas z on ST_Contains(z.geom, s.point)
),
placed as (
    select s.metric_id, i.geoid as municipality_geoid, z.geoid as zcta_geoid
    from sites s
    left join {{ ref('stg_nj_municipal_codes') }} i on i.identifier = s.cd_code
    left join site_zcta z on z.site = s.site
    where s.metric_id is not null
),
counted as (
    select metric_id, municipality_geoid as geoid, 'municipality' as level,
           'nj_cd_code' as match_method, count(*) as value
    from placed where municipality_geoid is not null group by all
    union all
    select metric_id, left(municipality_geoid, 5), 'county', 'nj_cd_code', count(*)
    from placed where municipality_geoid is not null group by all
    union all
    select metric_id, zcta_geoid, 'zip', 'point_in_area', count(*)
    from placed where zcta_geoid is not null group by all
    union all
    select metric_id, '34', 'state', 'nj_cd_code', count(*)
    from placed group by all
),
-- Every region with none of a kind has a zero, not a gap: the list is complete, so a
-- town absent from it has no open case.
regions as (
    select distinct geoid, 'municipality' as level
    from {{ ref('stg_nj_municipal_codes') }}
    union all
    select distinct left(geoid, 5), 'county' from {{ ref('stg_nj_municipal_codes') }}
    union all
    select geoid, 'zip' from zctas
    union all
    select '34', 'state'
),
metrics(metric_id) as (
    values ('njdep_sites_open'), ('njdep_sites_post_remedy'), ('njdep_sites_heating_oil')
),
year as (select {{ var('read_years')['njdep_kcsl'] }} as y)
select
    'njdep_kcsl' as source_id,
    m.metric_id,
    r.geoid,
    r.level,
    make_date(year.y, 1, 1) as period_start,
    make_date(year.y, 12, 31) as period_end,
    coalesce(c.value, 0)::double as value,
    case r.level when 'zip' then 'point_in_area' else 'nj_cd_code' end as match_method,
    'sites' as release_layer,
    'current' as release_vintage
from regions r
cross join metrics m
cross join year
left join counted c on c.geoid = r.geoid and c.level = r.level and c.metric_id = m.metric_id
