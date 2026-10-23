-- Each town's incorporation year and the people born in it, as Wikidata records them
-- (the visual stories, 2026-10-23). A municipality is matched by its FIPS 55 code and
-- its county's FIPS code, which together are its GEOID, no names involved. Several
-- items can carry one code (a town and a former one of the same name); the earliest
-- inception among them is kept. Built once `hip.sources.wikidata` has landed.
{{ config(materialized='table', enabled=var('story_wikidata_landed', false)) }}

with towns as (
    select GEOID as geoid
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
items as (
    select regexp_extract(item, 'Q[0-9]+$') as qid,
           '34' || right(county::varchar, 3) || replace(fips, '34-', '') as geoid,
           try_cast(left(inception::varchar, 4) as integer) as year
    from read_parquet('{{ var("parquet_dir") }}/wikidata/current/municipalities.parquet')
    where fips like '34-_____' and length(county::varchar) = 5
),
matched as (select i.* from items i join towns t using (geoid)),
incorporated as (
    select geoid, min(year) as year from matched where year is not null group by 1
),
births as (
    select m.geoid, count(distinct b.person) as people
    from read_parquet('{{ var("parquet_dir") }}/wikidata/current/births.parquet') b
    join (select distinct qid, geoid from matched) m
      on regexp_extract(b.place, 'Q[0-9]+$') = m.qid
    group by 1
),
year as (select {{ var('read_years')['wikidata'] }} as y)
select 'wikidata' as source_id, 'wikidata_incorporated_year' as metric_id, geoid,
       'municipality' as level, make_date(y, 1, 1) as period_start,
       make_date(y, 12, 31) as period_end, year::double as value,
       'fips' as match_method, 'municipalities' as release_layer,
       'current' as release_vintage
from incorporated, year
union all
select 'wikidata', 'wikidata_notable_births', t.geoid, 'municipality',
       make_date(y, 1, 1), make_date(y, 12, 31), coalesce(b.people, 0)::double, 'fips',
       'births', 'current'
from towns t left join births b using (geoid), year
