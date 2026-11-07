-- The year each town became the kind of municipality it is now, from Snyder's The Story
-- of New Jersey's Civil Boundaries (Boroughitis, review of 2026-11-06). Matched to a
-- Census town by its county and its full name ("Oaklyn borough"), letters only, so the
-- scan's stray punctuation does not break a match; where the book names a place twice
-- (one since gone), the current one wins. Towns it does not date keep Wikidata's
-- inception (stg_story_wikidata). Built once `hip.sources.nj_civil_boundaries` landed.
{{ config(materialized='table', enabled=var('story_boundaries_landed', false)) }}

with towns as (
    select GEOID as geoid, STATEFP || COUNTYFP as county_fips,
           regexp_replace(lower(NAMELSAD), '[^a-z]', '', 'g') as key
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
book as (
    select county_fips, regexp_replace(lower(name), '[^a-z]', '', 'g') as key,
           try_cast(year as integer) as year, defunct
    from read_parquet('{{ var("parquet_dir") }}/nj_civil_boundaries/*/municipalities.parquet')
),
matched as (
    select t.geoid, b.year,
           row_number() over (partition by t.geoid order by b.defunct::boolean, b.year) as pick
    from towns t join book b using (county_fips, key)
    where b.year is not null
),
year as (select {{ var('read_years')['nj_civil_boundaries'] }} as y)
select 'nj_civil_boundaries' as source_id, 'nj_incorporated_year' as metric_id, geoid,
       'municipality' as level, make_date(y, 1, 1) as period_start,
       make_date(y, 12, 31) as period_end, year::double as value,
       'name' as match_method, 'municipalities' as release_layer,
       '1969' as release_vintage
from matched, year
where pick = 1
