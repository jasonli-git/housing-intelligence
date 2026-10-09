-- HUD CHAS cost burden (Milestone 21), county and municipality: HUD's published
-- tabulation in place of a ratio the platform derives.
--
-- Fields per HUD's CHAS API dictionary: A16 and A17 are owner- and renter-occupied
-- households; D4 and D5 pay more than 30% and up to 50% of income for housing, D7 and D8
-- more than 50%, owners and renters respectively. Denominators include households whose
-- burden HUD could not compute (D10, D11: no or negative income), the same universe the
-- ACS ratio from B25070 uses, so the two read side by side.
--
-- Margins of error (#353) come from HUD's bulk files, Table 8, which the API leaves
-- out: each burden count there is split by five income bands, so it is summed back and
-- its margin is the root sum of squares of the bands' (`chas_sum_margin`), and
-- the share's margin is the Census's formula for a subset over its whole. A margin is
-- attached only where the bulk counts equal the API's exactly — a release the bulk files
-- do not cover yet keeps none — and `tests/chas_bulk_matches_api.sql` fails if any differ.
{% set owner_bands = [3, 16, 29, 42, 55] %}
{% set renter_bands = [69, 82, 95, 108, 121] %}
{{ config(materialized='table') }}

with raw as (
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud_chas/*/*.parquet', filename=true, union_by_name=true
    )
    -- The MCD directory lands here too, as `mcds_<state>`, with no `level`.
    where level in ('county', 'mcd')
),
bulk as (
    select
        json['level'] as level,
        json['geo_key'] as geo_key,
        {{ release_vintage('filename') }} as release_vintage,
        json['T8_est2']::double  as owners,
        json['T8_moe2']::double  as owners_moe,
        json['T8_est68']::double as renters,
        json['T8_moe68']::double as renters_moe,
        {% for name, bands, steps in [
            ('owners_30_to_50', owner_bands, [4]), ('owners_over_50', owner_bands, [7]),
            ('owners_burdened', owner_bands, [4, 7]),
            ('renters_30_to_50', renter_bands, [4]), ('renters_over_50', renter_bands, [7]),
            ('renters_burdened', renter_bands, [4, 7])
        ] -%}
        {%- set cells = [] -%}
        {%- for b in bands %}{% for step in steps %}{% do cells.append(b + step) %}{% endfor %}{% endfor %}
        ({% for c in cells %}json['T8_est{{ c }}']::double{% if not loop.last %} + {% endif %}{% endfor %})
            as {{ name }},
        {{ chas_sum_margin(cells) }} as {{ name }}_moe{% if not loop.last %},{% endif %}
        {% endfor %}
    from read_parquet(
        '{{ var("parquet_dir") }}/hud_chas_bulk/*/*.parquet', filename=true, union_by_name=true
    )
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
        r.level as source_level,
        r.geo_key,
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
with_margins as (
    -- The bulk margins, kept only where every count they qualify is the API's own.
    select
        k.*,
        b.owners is not null as bulk_present,
        coalesce(
            b.owners = k.owners and b.renters = k.renters
            and b.owners_30_to_50 = k.owners_30_to_50
            and b.owners_over_50 = k.owners_over_50
            and b.renters_30_to_50 = k.renters_30_to_50
            and b.renters_over_50 = k.renters_over_50,
            false
        ) as bulk_matches,
        b.owners_moe, b.renters_moe,
        b.owners_burdened_moe, b.owners_over_50_moe,
        b.renters_burdened_moe, b.renters_over_50_moe
    from keyed k
    left join bulk b
        on b.level = k.source_level
       and b.geo_key = k.geo_key
       and b.release_vintage = k.release_vintage
),
unpivoted as (
    select *, 'chas_renter_cost_burden' as metric_id,
           case when renters > 0 then (renters_30_to_50 + renters_over_50) / renters end
               as value,
           case when bulk_matches then {{ acs_share_margin(
               'renters_30_to_50 + renters_over_50', 'renters',
               'renters_burdened_moe', 'renters_moe') }} end as margin_of_error
    from with_margins
    union all
    select *, 'chas_renter_severe_burden',
           case when renters > 0 then renters_over_50 / renters end,
           case when bulk_matches then {{ acs_share_margin(
               'renters_over_50', 'renters', 'renters_over_50_moe', 'renters_moe') }} end
    from with_margins
    union all
    select *, 'chas_owner_cost_burden',
           case when owners > 0 then (owners_30_to_50 + owners_over_50) / owners end,
           case when bulk_matches then {{ acs_share_margin(
               'owners_30_to_50 + owners_over_50', 'owners',
               'owners_burdened_moe', 'owners_moe') }} end
    from with_margins
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
    margin_of_error,
    -- Kept for `tests/chas_bulk_matches_api.sql`; not read downstream.
    bulk_present,
    bulk_matches,
    'fips' as match_method,
    release_layer,
    release_vintage
from unpivoted
where value is not null
  and geoid is not null
