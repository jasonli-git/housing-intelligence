-- HUD CHAS cost burden (Milestone 21), county and municipality: HUD's published
-- tabulation in place of a ratio the platform derives.
--
-- Fields per HUD's CHAS API dictionary: A16 and A17 are owner- and renter-occupied
-- households; D4 and D5 pay more than 30% and up to 50% of income for housing, D7 and D8
-- more than 50%, owners and renters respectively. Denominators include households whose
-- burden HUD could not compute (D10, D11: no or negative income), the same universe the
-- ACS ratio from B25070 uses, so the two read side by side.
{{ config(materialized='table') }}

with raw as (
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud_chas/*/*.parquet', filename=true, union_by_name=true
    )
    -- The MCD directory lands here too, as `mcds_<state>`, with no `level`.
    where level in ('county', 'mcd')
),
municipal as (
    -- A CHAS row names its municipality by MCD code alone, with no county. TIGER maps
    -- state plus MCD code to the GEOID, reading the file stg_nj_municipal_codes reads;
    -- MCD codes are unique within a state.
    select distinct STATEFP || COUSUBFP as geo_key, GEOID as geoid
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_*.parquet')
    where COUSUBFP <> '00000'
),
keyed as (
    select
        case when r.level = 'county' then r.geo_key else m.geoid end as geoid,
        case when r.level = 'county' then 'county' else 'municipality' end as level,
        r.level || '_' || r.geo_key as release_layer,
        {{ release_vintage('r.filename') }} as release_vintage,
        "A16"::double as owners,
        "A17"::double as renters,
        "D4"::double  as owners_30_to_50,
        "D7"::double  as owners_over_50,
        "D5"::double  as renters_30_to_50,
        "D8"::double  as renters_over_50
    from raw r
    left join municipal m on r.level = 'mcd' and m.geo_key = r.geo_key
),
unpivoted as (
    select *, 'chas_renter_cost_burden' as metric_id,
           case when renters > 0 then (renters_30_to_50 + renters_over_50) / renters end
               as value
    from keyed
    union all
    select *, 'chas_renter_severe_burden',
           case when renters > 0 then renters_over_50 / renters end
    from keyed
    union all
    select *, 'chas_owner_cost_burden',
           case when owners > 0 then (owners_30_to_50 + owners_over_50) / owners end
    from keyed
)
select
    'hud_chas' as source_id,
    metric_id,
    geoid,
    level,
    -- A CHAS vintage names the five ACS years it tabulates, as `2018-2022`.
    make_date(split_part(release_vintage, '-', 1)::int, 1, 1)  as period_start,
    make_date(split_part(release_vintage, '-', 2)::int, 12, 31) as period_end,
    value,
    'fips' as match_method,
    release_layer,
    release_vintage
from unpivoted
where value is not null
  and geoid is not null
