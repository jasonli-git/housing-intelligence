-- What a home costs beyond its mortgage and tax (Milestone 33): homeowners insurance
-- (B25141), the utility bills (B25132–B25135), and whether renters pay utilities on top
-- of rent (B25069), at county, municipality and, since Milestone 34, ZCTA. The Census
-- publishes the costs only in brackets, so each typical figure is the median interpolated
-- within its brackets (`bracket_median`), among the homes charged for it. No margin: the Census publishes
-- none for a median worked out here, and the packet says so rather than inventing one.
{{ config(materialized='table') }}

with raw as (
    {{ acs_layers('insurance_') }}
    union all by name
    {{ acs_layers('utilities_') }}
),
{%- set tables = {
    'ins': ('B25141', range(3, 15)),
    'elec': ('B25132', range(4, 10)),
    'gas': ('B25133', range(4, 10)),
    'water': ('B25134', range(4, 10)),
    'fuel': ('B25135', range(4, 7)),
} %}
keyed as (
    select
        geoid,
        level,
        release_layer,
        vintage,
        {%- for name, (table, cells) in tables.items() %}
        {%- for cell in cells %}
        -- The same suppression sentinel stg_census_acs refuses.
        nullif(nullif("{{ table }}_{{ '%03d' % cell }}E", '-666666666'), '')::double
            as {{ name }}{{ loop.index0 }},
        {%- endfor %}
        {%- endfor %}
        nullif(nullif("B25069_001E", '-666666666'), '')::double as renters,
        nullif(nullif("B25069_002E", '-666666666'), '')::double as renters_paying_extra
    from raw
),
unpivoted as (
    -- Owners with a mortgage: the household buying with a loan is the one a lender makes
    -- insure the home, so it is the cost a buyer faces.
    select geoid, level, release_layer, vintage, 'acs_median_home_insurance' as metric_id,
           {{ bracket_median('ins', [0, 100, 300, 500, 800, 1000, 1500, 2000, 2500,
                                     3000, 3500, 4000]) }} as value
    from keyed where release_layer like 'insurance_%'
    union all
    select geoid, level, release_layer, vintage, 'acs_median_electricity',
           {{ bracket_median('elec', [0, 50, 100, 150, 200, 250]) }}
    from keyed where release_layer like 'utilities_%'
    union all
    select geoid, level, release_layer, vintage, 'acs_median_gas',
           {{ bracket_median('gas', [0, 25, 50, 75, 100, 150]) }}
    from keyed where release_layer like 'utilities_%'
    union all
    select geoid, level, release_layer, vintage, 'acs_median_water_sewer',
           {{ bracket_median('water', [0, 125, 250, 500, 750, 1000]) }}
    from keyed where release_layer like 'utilities_%'
    union all
    select geoid, level, release_layer, vintage, 'acs_median_other_fuel',
           {{ bracket_median('fuel', [0, 250, 750]) }}
    from keyed where release_layer like 'utilities_%'
    union all
    -- Renters who pay for at least one utility on top of their rent.
    select geoid, level, release_layer, vintage, 'acs_renters_paying_utilities',
           case when renters > 0 then renters_paying_extra / renters end
    from keyed where release_layer like 'utilities_%'
)
select
    'census_acs' as source_id,
    metric_id,
    geoid,
    level,
    make_date(vintage - 4, 1, 1) as period_start,
    make_date(vintage, 12, 31)   as period_end,
    value,
    null::double as margin_of_error,
    case when level = 'zip' then 'zcta' else 'fips' end as match_method,
    release_layer,
    vintage::varchar as release_vintage
from unpivoted
where value is not null
