-- Housing units certified and demolished, per town, county and the state, from DCA's
-- Construction Reporter (Milestone 39, ARCHITECTURE #300).
--
-- A certificate of occupancy is the end of the construction process: a building complete
-- and ready to live in. A demolition counts the dwelling units it removes. Net additions
-- are certified less demolished, only for a town whose official reported both that year.
--
-- **Missing is not zero.** A town absent from a year's file reported nothing, and has no
-- observation that year. A county's or the state's figure sums the towns that did, and
-- the share of towns it sums is published beside it (`nj_*_reporting_share`).
--
-- A year with a yearly summary is read from it; 2025, which has none yet, from
-- December's year-to-date report (vintage `2025-ytd`, preliminary). Should a summary
-- appear, it replaces the year to date rather than doubling it.
--
-- Keyed on the CD code through `stg_nj_municipal_codes`: an old code a merged town left
-- behind matches nothing and drops out.
{{ config(materialized='table') }}

with raw as (
    select *,
           regexp_extract(filename, '/([^/]+)\.parquet$', 1) as layer,
           {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/nj_construction/*/*.parquet',
                      filename=true, union_by_name=true)
),
landed as (
    -- Princeton consolidated in 2013, and DCA filed it under the former township's code
    -- (1110) until 2021, sometimes beside a "Princeton Twp" line of the same code; the
    -- former borough's (1109) reports zeros. Both are Princeton's (1114), and a code a
    -- year lists twice is summed, so nothing is picked from duplicates at random.
    select layer, release_vintage, year, preliminary,
           case when cd_code in ('1109', '1110') then '1114' else cd_code end as cd_code,
           sum(total) as total, sum(one_two_family) as one_two_family,
           sum(multifamily) as multifamily, sum(mixed_use) as mixed_use
    from raw
    group by all
),
chosen as (
    -- The yearly summary over the year to date, for a year that has both.
    select * from (
        select *, row_number() over (
            partition by layer, cd_code, year order by preliminary
        ) as pick
        from landed
    ) where pick = 1
),
towns as (
    select c.layer, c.year, c.release_vintage, i.geoid,
           left(i.geoid, 5) as county_geoid,
           c.total, c.one_two_family, c.multifamily, c.mixed_use
    from chosen c
    join {{ ref('stg_nj_municipal_codes') }} i on i.identifier = c.cd_code
),
municipal_count as (
    select left(geoid, 5) as county_geoid, count(*) as towns
    from {{ ref('stg_nj_municipal_codes') }}
    group by 1
),
net as (
    -- Only where the town reported both; the certificates' release is cited.
    select cert.year, cert.release_vintage, cert.geoid, cert.county_geoid,
           cert.total - demo.total as net_units
    from towns cert
    join towns demo
      on demo.geoid = cert.geoid and demo.year = cert.year
     and demo.layer = 'demolished'
    where cert.layer = 'certified'
),
municipal as (
    select 'nj_units_certified' as metric_id, geoid, 'municipality' as level, year,
           total as value, 'certified' as release_layer, release_vintage
    from towns where layer = 'certified'
    union all
    select 'nj_units_certified_1_2', geoid, 'municipality', year, one_two_family,
           'certified', release_vintage
    from towns where layer = 'certified' and one_two_family is not null
    union all
    select 'nj_units_certified_multi', geoid, 'municipality', year, multifamily,
           'certified', release_vintage
    from towns where layer = 'certified' and multifamily is not null
    union all
    select 'nj_units_certified_mixed', geoid, 'municipality', year, mixed_use,
           'certified', release_vintage
    from towns where layer = 'certified' and mixed_use is not null
    union all
    select 'nj_units_demolished', geoid, 'municipality', year, total,
           'demolished', release_vintage
    from towns where layer = 'demolished'
    union all
    select 'nj_net_units_added', geoid, 'municipality', year, net_units,
           'certified', release_vintage
    from net
),
-- Counties and the state: sums over the towns that reported, a county by its
-- towns' geoid prefix and the state over all.
grouped as (
    select t.*, g.area_geoid, g.area_level
    from towns t,
         lateral (values (t.county_geoid, 'county'), ('34', 'state'))
             as g(area_geoid, area_level)
),
area_totals as (
    select area_geoid, area_level, layer, year, max(release_vintage) as release_vintage,
           sum(total) as total, sum(one_two_family) as one_two_family,
           sum(multifamily) as multifamily, sum(mixed_use) as mixed_use,
           count(*) as reporting
    from grouped
    group by 1, 2, 3, 4
),
area_towns as (
    select county_geoid as area_geoid, 'county' as area_level, towns
    from municipal_count
    union all
    select '34', 'state', sum(towns) from municipal_count
),
area_net as (
    select g.area_geoid, g.area_level, n.year, max(n.release_vintage) as release_vintage,
           sum(n.net_units) as net_units
    from net n,
         lateral (values (n.county_geoid, 'county'), ('34', 'state'))
             as g(area_geoid, area_level)
    group by 1, 2, 3
),
areas as (
    select case layer when 'certified' then 'nj_units_certified'
                      else 'nj_units_demolished' end as metric_id,
           area_geoid as geoid, area_level as level, year, total as value,
           layer as release_layer, release_vintage
    from area_totals
    union all
    select 'nj_units_certified_1_2', area_geoid, area_level, year, one_two_family,
           layer, release_vintage
    from area_totals where layer = 'certified'
    union all
    select 'nj_units_certified_multi', area_geoid, area_level, year, multifamily,
           layer, release_vintage
    from area_totals where layer = 'certified'
    union all
    select 'nj_units_certified_mixed', area_geoid, area_level, year, mixed_use,
           layer, release_vintage
    from area_totals where layer = 'certified'
    union all
    select case a.layer when 'certified' then 'nj_certificates_reporting_share'
                        else 'nj_demolitions_reporting_share' end,
           a.area_geoid, a.area_level, a.year, a.reporting::double / t.towns,
           a.layer, a.release_vintage
    from area_totals a
    join area_towns t using (area_geoid, area_level)
    union all
    select 'nj_net_units_added', area_geoid, area_level, year, net_units,
           'certified', release_vintage
    from area_net
)
select
    'nj_construction' as source_id,
    metric_id,
    geoid,
    level,
    make_date(year, 1, 1) as period_start,
    make_date(year, 12, 31) as period_end,
    value::double as value,
    'nj_cd_code' as match_method,
    release_layer,
    release_vintage
from (select * from municipal union all select * from areas)
where value is not null
