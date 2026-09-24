-- NJ MOD-IV parcels aggregated to municipalities and counties.
--
-- 3.48M parcel rows in; 564 municipalities x 7 metrics and 21 counties x 6 out. The
-- parcels themselves are never promoted to Postgres (ARCHITECTURE #16); this model is the
-- boundary where the parcel tier becomes warehouse facts.
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
        LAST_YR_TX,
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

-- CD code to GEOID, from the one model that owns that mapping. This used to re-derive
-- the name match here, which meant two implementations of the same join and only one of
-- them carrying the ten aliases that complete it -- so `modiv_median_tax_bill` covered
-- 554 municipalities while a tax *rate* on the same page covered 564.
matched as (
    select identifier as cd_code, geoid from {{ ref('stg_nj_municipal_codes') }}
),

-- Each parcel under every region it belongs to. A municipality takes the parcels its
-- CD code resolves; a county takes every coded parcel in it, by arithmetic on the
-- county half of the code, so a county never depended on the municipal match even
-- while ten of those matches were missing. A county's figures
-- are therefore taken over its parcels -- never a median of municipal medians, which is
-- a different and meaningless number (Milestone 17). '34' is New Jersey's state FIPS,
-- the only state MOD-IV covers.
placed as (
    select m.geoid, 'municipality' as level, p.*
    from parcels p
    join matched m on m.cd_code = p.CD_CODE
    union all
    select '34' || lpad((2 * substr(p.CD_CODE, 1, 2)::int - 1)::varchar, 3, '0'),
           'county',
           p.*
    from parcels p
),

aggregated as (
    select
        geoid,
        level,
        -- The publisher's own release date for the region's parcels. Counties
        -- publish on their own cycles, so this genuinely varies; using it means the
        -- observation period is measured rather than assumed.
        -- ArcGIS serializes a date field as epoch milliseconds, so this is a BIGINT
        -- on arrival and a direct ::date cast fails outright rather than silently
        -- producing 1970.
        epoch_ms(max(PCL_PBDATE))::date as published,
        median(case when PROP_CLASS = '2' and NET_VALUE > 0
                    then NET_VALUE end)                            as median_assessed_value,
        count(*) filter (where PROP_CLASS = '2')::double            as residential_parcels,
        -- 1600 floor: MOD-IV uses 0 and stray small integers for "unknown", which would
        -- drag a median of build years into the middle ages.
        median(case when PROP_CLASS = '2' and YR_CONSTR between 1600 and 2100
                    then YR_CONSTR end)                            as median_year_built,
        median(case when PROP_CLASS = '2' and CALC_ACRE > 0
                    then CALC_ACRE end)                            as median_lot_acres,
        count(*) filter (where PROP_CLASS = '1')::double
            / nullif(count(*), 0)                                  as vacant_land_share,
        count(*) filter (where PROP_CLASS = '4C')::double
            / nullif(count(*) filter (where PROP_CLASS in ('2', '4C')), 0)
                                                                   as multifamily_share,
        -- Last year's total tax on the parcel, in dollars. A zero is an exempt or
        -- unbilled parcel, not a free house, so it is left out of the median.
        median(case when PROP_CLASS = '2' and LAST_YR_TX > 0
                    then LAST_YR_TX end)                           as median_tax_bill
    from placed
    group by 1, 2
),

unpivoted as (
    -- Municipal only. Each municipality assesses at its own ratio of market value, so
    -- a county median of assessments mixes incomparable numbers; the tax bill below is
    -- real dollars and has no such problem.
    select geoid, level, published, 'modiv_median_assessed_value' as metric_id,
           median_assessed_value as value from aggregated where level = 'municipality'
    union all
    select geoid, level, published, 'modiv_residential_parcels', residential_parcels
    from aggregated
    union all
    select geoid, level, published, 'modiv_median_year_built', median_year_built
    from aggregated
    union all
    select geoid, level, published, 'modiv_median_lot_acres', median_lot_acres
    from aggregated
    union all
    select geoid, level, published, 'modiv_vacant_land_share', vacant_land_share
    from aggregated
    union all
    select geoid, level, published, 'modiv_multifamily_share', multifamily_share
    from aggregated
    union all
    select geoid, level, published, 'modiv_median_tax_bill', median_tax_bill
    from aggregated
)

select
    'nj_modiv' as source_id,
    metric_id,
    geoid,
    level,
    -- The tax year NJOGIS joined the composite to (Milestone 26), read from its
    -- metadata at acquisition. Every value here is that year's: assessments, class,
    -- and `LAST_YR_TX`, which equals each parcel's assessed value times its town's
    -- general rate for that year. Until 2026-09-23 these were dated by `PCL_PBDATE`,
    -- when a county last republished its parcel *shapes* — so a 2024 tax bill read
    -- "Jun 2026" in one town and "Oct 2023" in another. Parcel shapes republished
    -- after the join change a lot's acreage slightly and nothing else.
    --
    -- Without a recorded tax year (discovery has never run) the publication date
    -- stands, which is how this was dated before. Change metrics need two tax years;
    -- until a second is loaded these are ranked by value rather than by change.
    {% if var('modiv_tax_year', none) %}
    make_date({{ var('modiv_tax_year') }}, 1, 1) as period_start,
    make_date({{ var('modiv_tax_year') }}, 12, 31) as period_end,
    {% else %}
    published as period_start,
    published as period_end,
    {% endif %}
    value::double as value,
    'nj_cd_code' as match_method,
    -- One statewide composite is all the publisher offers (see the adapter).
    'statewide' as release_layer,
    'current' as release_vintage
from unpivoted
where value is not null
