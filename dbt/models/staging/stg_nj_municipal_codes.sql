-- NJ's own municipal code for each Census municipality.
--
-- `region_identifiers` was created at Milestone 1 with exactly this in mind and has been
-- empty ever since: decision #21 chose Census MCD FIPS as the municipality key and said
-- NJ's code would be stored alongside it once MOD-IV arrived, so a state source could
-- join without a crosswalk and without anyone having to revisit the key decision.
--
-- Same matching as `stg_nj_modiv`, kept as its own model because it is a different
-- thing: that one produces facts, this one produces an identifier. A future NJ source
-- keyed on CD_CODE joins through this table and needs no name matching at all.
{{ config(materialized='table') }}

with census_muni as (
    select
        GEOID as geoid,
        COUNTYFP as countyfp,
        {{ nj_municipal_name('NAMELSAD') }} as key_with_form,
        {{ nj_municipal_name('NAME') }} as key_bare
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    where COUSUBFP <> '00000'
),

modiv_muni as (
    select distinct
        CD_CODE as cd_code,
        -- NJ county codes run 01-21 alphabetically and NJ county FIPS run odd and
        -- alphabetically, so the county half of the code resolves by arithmetic.
        lpad((2 * substr(CD_CODE, 1, 2)::int - 1)::varchar, 3, '0') as countyfp,
        {{ nj_municipal_name('MUN_NAME') }} as name_key
    from read_parquet('{{ var("parquet_dir") }}/nj_modiv/*/statewide.parquet')
    where CD_CODE is not null and CD_CODE <> '' and MUN_NAME is not null
),

candidates as (
    select distinct m.cd_code, c.geoid
    from modiv_muni m
    join census_muni c
      on c.countyfp = m.countyfp
     and (c.key_with_form = m.name_key or c.key_bare = m.name_key)
)

select cd_code as identifier, geoid, 'nj_cd_code' as scheme
from candidates
where cd_code in (select cd_code from candidates group by 1 having count(*) = 1)
  and geoid in (select geoid from candidates group by 1 having count(*) = 1)
