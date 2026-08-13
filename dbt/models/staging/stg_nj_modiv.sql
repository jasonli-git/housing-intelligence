-- NJ MOD-IV parcels aggregated to municipalities.
--
-- 3.48M parcel rows in, 564 municipalities x 6 metrics out. The parcels themselves are
-- never promoted to Postgres (ARCHITECTURE #16); this model is the boundary where the
-- parcel tier becomes warehouse facts.
--
-- The join that makes it possible: MOD-IV's CD_CODE is a 4-digit NJ code, county (01-21
-- alphabetical) then municipality. NJ county FIPS run odd and alphabetical, so the
-- county half resolves by arithmetic -- FIPS = 2*code - 1 -- with no name matching at
-- all. Only the municipality half needs a name, and MOD-IV carries the legal form
-- ("BOONTON TWP" vs "BOONTON TOWN") which is exactly what Zillow lacks. Matching
-- NAMELSAD against the form-qualified name separates Boonton town from Boonton
-- township and Chatham borough from Chatham township, so this source resolves exactly
-- where Zillow could only guess (ARCHITECTURE #27, #50).
{{ config(materialized='table') }}

with parcels as (
    select
        CD_CODE,
        PROP_CLASS,
        NET_VALUE,
        YR_CONSTR,
        CALC_ACRE,
        PCL_PBDATE
    from read_parquet('{{ var("parquet_dir") }}/nj_modiv/*/statewide.parquet')
    -- ~1.4% of parcels carry no CD_CODE: the composite could not confidently match
    -- the polygon to a MOD-IV record. They cannot be attributed to a municipality, so
    -- they are dropped here and counted by the validation gate rather than silently
    -- diluting a denominator.
    where CD_CODE is not null and CD_CODE <> ''
),

-- Census municipalities, under both published names. NAMELSAD carries the legal form
-- ("Egg Harbor township"); NAME does not ("Egg Harbor"), and for a handful of places
-- the legal form is part of the name itself ("Egg Harbor City city"). Matching against
-- either covers both without inventing a third spelling.
census_muni as (
    select
        GEOID as geoid,
        COUNTYFP as countyfp,
        {{ nj_municipal_name('NAMELSAD') }} as key_with_form,
        {{ nj_municipal_name('NAME') }} as key_bare
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_NJ.parquet')
    -- 'County subdivisions not defined' -- water and unassigned area, filtered on the
    -- same key the region loader uses.
    where COUSUBFP <> '00000'
),

modiv_muni as (
    select distinct
        CD_CODE as cd_code,
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

-- One CD_CODE to one GEOID, or nothing. A code matching two municipalities, or two
-- codes matching one municipality, is rejected on both sides (ARCHITECTURE #28).
-- Neither side currently rejects anything: all 554 matches are one-to-one. The check
-- stays because "currently unambiguous" is not the same as "cannot become ambiguous",
-- and a silent duplicate here would put one town's assessments on another.
matched as (
    select cd_code, geoid from candidates
    where cd_code in (select cd_code from candidates group by 1 having count(*) = 1)
      and geoid in (select geoid from candidates group by 1 having count(*) = 1)
),

aggregated as (
    select
        m.geoid,
        -- The publisher's own release date for the municipality's parcels. Counties
        -- publish on their own cycles, so this genuinely varies; using it means the
        -- observation period is measured rather than assumed.
        -- ArcGIS serializes a date field as epoch milliseconds, so this is a BIGINT
        -- on arrival and a direct ::date cast fails outright rather than silently
        -- producing 1970.
        epoch_ms(max(p.PCL_PBDATE))::date as published,
        median(case when p.PROP_CLASS = '2' and p.NET_VALUE > 0
                    then p.NET_VALUE end)                          as median_assessed_value,
        count(*) filter (where p.PROP_CLASS = '2')::double          as residential_parcels,
        -- 1600 floor: MOD-IV uses 0 and stray small integers for "unknown", which would
        -- drag a median of build years into the middle ages.
        median(case when p.PROP_CLASS = '2' and p.YR_CONSTR between 1600 and 2100
                    then p.YR_CONSTR end)                          as median_year_built,
        median(case when p.PROP_CLASS = '2' and p.CALC_ACRE > 0
                    then p.CALC_ACRE end)                          as median_lot_acres,
        count(*) filter (where p.PROP_CLASS = '1')::double
            / nullif(count(*), 0)                                  as vacant_land_share,
        count(*) filter (where p.PROP_CLASS = '4C')::double
            / nullif(count(*) filter (where p.PROP_CLASS in ('2', '4C')), 0)
                                                                   as multifamily_share
    from parcels p
    join matched m on m.cd_code = p.CD_CODE
    group by 1
),

unpivoted as (
    select geoid, published, 'modiv_median_assessed_value' as metric_id,
           median_assessed_value as value from aggregated
    union all
    select geoid, published, 'modiv_residential_parcels', residential_parcels
    from aggregated
    union all
    select geoid, published, 'modiv_median_year_built', median_year_built from aggregated
    union all
    select geoid, published, 'modiv_median_lot_acres', median_lot_acres from aggregated
    union all
    select geoid, published, 'modiv_vacant_land_share', vacant_land_share from aggregated
    union all
    select geoid, published, 'modiv_multifamily_share', multifamily_share from aggregated
)

select
    'nj_modiv' as source_id,
    metric_id,
    geoid,
    'municipality' as level,
    -- A snapshot, not a span: start and end are the same published date. Change
    -- metrics need two observations and MOD-IV publishes one composite, which is why
    -- these metrics are ranked by value rather than by change.
    published as period_start,
    published as period_end,
    value::double as value,
    'nj_cd_code' as match_method,
    'current' as release_vintage
from unpivoted
where value is not null
