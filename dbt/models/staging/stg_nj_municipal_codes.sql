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
),

resolved as (
    select cd_code, geoid
    from candidates
    where cd_code in (select cd_code from candidates group by 1 having count(*) = 1)
      and geoid in (select geoid from candidates group by 1 having count(*) = 1)
),

-- The ten MOD-IV cannot spell, resolved one at a time rather than by rule.
--
-- `MUN_NAME` is a fixed-width field and these ten overflow it: "UPPER SADDLE RIV",
-- "PARSIPPANY TR HLS", "SOUTH ORANGE VILLAGE TW". One is not truncated at all --
-- MOD-IV writes "ORANGE CITY TWP" where Census writes "City of Orange township",
-- which is a different word order. No normalisation rule covers both without also
-- matching places it should not, and inventing one is what ARCHITECTURE #27 and #28
-- rejected after "township" stripping merged Boonton with Boonton Township.
--
-- This is the other way to be exact: not a rule that guesses, but a list that is
-- checked. Each row was verified on 2026-09-19 against TIGER by county -- the county
-- half of the CD code is arithmetic, so the county is known independently of the name
-- -- and each candidate was the only municipality of that name in that county and was
-- unclaimed by the name match. `tests/test_nj_municipal_codes.py` re-checks all three
-- properties, so a bad row fails rather than silently attributing one town's figures
-- to another.
--
-- Until this existed, these ten had no GEOID and therefore no municipal figures at
-- all -- including Parsippany-Troy Hills, the state's 18th largest municipality.
aliases(cd_code, geoid) as (
    values
        ('0263', '3400375140'),  -- UPPER SADDLE RIV BORO -> Upper Saddle River borough
        ('0703', '3401309250'),  -- CALDWELL BORO TWP     -> Caldwell borough
        ('0706', '3401321840'),  -- ESSEX FELLS TWP       -> Essex Fells borough
        ('0715', '3401352620'),  -- NORTH CALDWELL TWP    -> North Caldwell borough
        ('0717', '3401313045'),  -- ORANGE CITY TWP       -> City of Orange township
        ('0719', '3401369274'),  -- SOUTH ORANGE VILLAGE TW -> South Orange Village twp
        ('1429', '3402756460'),  -- PARSIPPANY TR HLS TWP -> Parsippany-Troy Hills twp
        ('1526', '3402959910'),  -- PT PLEASANT BEACH BORO -> Point Pleasant Beach boro
        ('1705', '3403341640'),  -- LOWER ALLOWAY CREEK TWP -> Lower Alloways Creek twp
        ('1815', '3403557300')   -- PEAPACK GLADSTONE BORO -> Peapack and Gladstone boro
),

combined as (
    select cd_code, geoid from resolved
    union all
    -- An alias never overrides the name match; it only fills a gap the match left.
    select cd_code, geoid from aliases
    where cd_code not in (select cd_code from resolved)
      and geoid not in (select geoid from resolved)
)

select cd_code as identifier, geoid, 'nj_cd_code' as scheme
from combined
