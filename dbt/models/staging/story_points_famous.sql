-- The most widely known person born in each town, by Wikidata's count of Wikipedia
-- language editions with an article on them (the visual stories, 2026-10-23): one
-- label for each town's dot. Ties go to the earlier Wikidata item.
{{ config(materialized='table', enabled=var('story_wikidata_landed', false)) }}

with towns as (
    select GEOID as geoid
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),
places as (
    select distinct regexp_extract(item, 'Q[0-9]+$') as qid,
           '34' || right(county::varchar, 3) || replace(fips, '34-', '') as geoid
    from read_parquet('{{ var("parquet_dir") }}/wikidata/current/municipalities.parquet')
    where fips like '34-_____' and length(county::varchar) = 5
),
people as (
    select p.geoid, b.personLabel as name, b.links,
           row_number() over (partition by p.geoid
                              order by b.links desc,
                                       try_cast(regexp_extract(b.person, '[0-9]+$') as bigint))
               as n
    from read_parquet('{{ var("parquet_dir") }}/wikidata/current/births.parquet') b
    join places p on regexp_extract(b.place, 'Q[0-9]+$') = p.qid
    join towns t on t.geoid = p.geoid
    -- An item with no English label comes back as its own id; it names nobody.
    where not regexp_matches(b.personLabel, '^Q[0-9]+$')
)
select 'hometown-famous' as story_id, 'most_known' as series, geoid,
       'municipality' as level, '1' as x, links::double as y, name as label,
       'wikidata' as source_id, 'births' as layer, 'current' as vintage
from people where n = 1
