-- The homes themselves, from the ACS in depth (Milestone 34): rent by bedrooms and its
-- spread, owner costs by mortgage, the severely burdened, the kind and age of the homes,
-- their size and condition, crowding, why the empty ones are empty, and heating fuel —
-- at county, municipality and ZCTA, each with its margin of error. Reads the `rent_`,
-- `stock_`, `rooms_` and `vacancy_` layers.
{{ config(materialized='table') }}

{%- set medians = ['B25031_002', 'B25031_003', 'B25031_004', 'B25031_005', 'B25031_006',
                   'B25057_001', 'B25059_001', 'B25088_002', 'B25088_003',
                   'B25035_001', 'B25010_001'] %}

{%- set layers = {
    'rent_': ['B25031_002', 'B25031_003', 'B25031_004', 'B25031_005', 'B25031_006',
              'B25057_001', 'B25059_001', 'B25088_002', 'B25088_003',
              'B25070_001', 'B25070_010', 'B25070_011',
              'B25091_001', 'B25091_011', 'B25091_012', 'B25091_022', 'B25091_023'],
    'stock_': ['B25024_001', 'B25024_002', 'B25024_003', 'B25024_004', 'B25024_005',
               'B25024_006', 'B25024_007', 'B25024_008', 'B25024_009', 'B25024_010',
               'B25034_001', 'B25034_002', 'B25034_003', 'B25034_004', 'B25034_005',
               'B25034_006', 'B25034_007', 'B25034_008', 'B25034_009', 'B25034_010',
               'B25034_011', 'B25035_001'],
    'rooms_': ['B25041_001', 'B25041_002', 'B25041_003', 'B25041_004', 'B25041_005',
               'B25041_006', 'B25041_007',
               'B25014_001', 'B25014_005', 'B25014_006', 'B25014_007', 'B25014_011',
               'B25014_012', 'B25014_013',
               'B25047_001', 'B25047_003', 'B25051_001', 'B25051_003', 'B25010_001',
               'B25044_001', 'B25044_003', 'B25044_010'],
    'vacancy_': ['B25004_001', 'B25004_002', 'B25004_003', 'B25004_004', 'B25004_005',
                 'B25004_006', 'B25004_007', 'B25004_008',
                 'B25003_001', 'B25003_002', 'B25003_003',
                 'B25040_001', 'B25040_002', 'B25040_003', 'B25040_004', 'B25040_005',
                 'B25040_006', 'B25040_007', 'B25040_008', 'B25040_009', 'B25040_010'],
} %}

with
{%- for prefix, variables in layers.items() %}
{{ prefix }}keyed as (
    select geoid, level, release_layer, vintage,
           {{ acs_columns(variables, medians) }}
    from ({{ acs_layers(prefix) }})
),
{%- endfor %}
unpivoted as (
    -- Rent and owner costs.
    {{ acs_level('acs_median_rent_studio', 'B25031_002', relation='rent_keyed') }}
    union all {{ acs_level('acs_median_rent_1br', 'B25031_003', relation='rent_keyed') }}
    union all {{ acs_level('acs_median_rent_2br', 'B25031_004', relation='rent_keyed') }}
    union all {{ acs_level('acs_median_rent_3br', 'B25031_005', relation='rent_keyed') }}
    union all {{ acs_level('acs_median_rent_4br', 'B25031_006', relation='rent_keyed') }}
    -- Contract rent, what is paid to the landlord: the Census publishes its quartiles,
    -- and none for gross rent.
    union all {{ acs_level('acs_rent_lower_quartile', 'B25057_001', relation='rent_keyed') }}
    union all {{ acs_level('acs_rent_upper_quartile', 'B25059_001', relation='rent_keyed') }}
    union all {{ acs_level('acs_owner_costs_mortgage', 'B25088_002', relation='rent_keyed') }}
    union all {{ acs_level('acs_owner_costs_no_mortgage', 'B25088_003', relation='rent_keyed') }}
    -- Half of income or more, over the households whose burden could be computed — the
    -- universe acs_renter_cost_burden has used since Milestone 28.
    union all {{ acs_share('acs_renter_severe_burden', ['B25070_010'],
                           ['B25070_001'], ['B25070_011'], relation='rent_keyed') }}
    union all {{ acs_share('acs_owner_severe_burden', ['B25091_011', 'B25091_022'],
                           ['B25091_001'], ['B25091_012', 'B25091_023'], relation='rent_keyed') }}

    -- The kind of building, by units in it.
    union all {{ acs_share('acs_share_detached', ['B25024_002'], ['B25024_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_attached', ['B25024_003'], ['B25024_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_2_4_units', ['B25024_004', 'B25024_005'], ['B25024_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_5_19_units', ['B25024_006', 'B25024_007'], ['B25024_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_20plus_units', ['B25024_008', 'B25024_009'], ['B25024_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_mobile_homes', ['B25024_010'], ['B25024_001'], relation='stock_keyed') }}
    -- When it was built. The newest cells were renamed between editions (2014-or-later
    -- in 2019, 2020-or-later from 2022), so the bands start at 2000, which every edition
    -- splits the same way.
    union all {{ acs_level('acs_median_year_built', 'B25035_001', relation='stock_keyed') }}
    union all {{ acs_share('acs_share_built_2000_later', ['B25034_002', 'B25034_003', 'B25034_004'], ['B25034_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_built_1980_1999', ['B25034_005', 'B25034_006'], ['B25034_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_built_1940_1979', ['B25034_007', 'B25034_008', 'B25034_009', 'B25034_010'], ['B25034_001'], relation='stock_keyed') }}
    union all {{ acs_share('acs_share_built_pre_1940', ['B25034_011'], ['B25034_001'], relation='stock_keyed') }}

    -- Size, condition and crowding.
    union all {{ acs_share('acs_share_0_1_bedrooms', ['B25041_002', 'B25041_003'], ['B25041_001'], relation='rooms_keyed') }}
    union all {{ acs_share('acs_share_2_bedrooms', ['B25041_004'], ['B25041_001'], relation='rooms_keyed') }}
    union all {{ acs_share('acs_share_3_bedrooms', ['B25041_005'], ['B25041_001'], relation='rooms_keyed') }}
    union all {{ acs_share('acs_share_4plus_bedrooms', ['B25041_006', 'B25041_007'], ['B25041_001'], relation='rooms_keyed') }}
    -- More than one occupant per room, owners and renters together: the Census's measure
    -- of crowding.
    union all {{ acs_share('acs_overcrowded_share',
                           ['B25014_005', 'B25014_006', 'B25014_007',
                            'B25014_011', 'B25014_012', 'B25014_013'],
                           ['B25014_001'], relation='rooms_keyed') }}
    union all {{ acs_share('acs_lacking_plumbing_share', ['B25047_003'], ['B25047_001'], relation='rooms_keyed') }}
    union all {{ acs_share('acs_lacking_kitchen_share', ['B25051_003'], ['B25051_001'], relation='rooms_keyed') }}
    union all {{ acs_level('acs_avg_household_size', 'B25010_001', relation='rooms_keyed') }}
    union all {{ acs_share('acs_no_vehicle_share', ['B25044_003', 'B25044_010'], ['B25044_001'], relation='rooms_keyed') }}

    -- Vacancy. The rental vacancy rate is the homes for rent over every home renting or
    -- for rent — occupied by renters, rented and not yet moved into, and for rent — and
    -- the homeowner rate the same for sale; the Census's own definitions. A seasonal home
    -- is in neither, which is why these read so differently from acs_vacancy_rate.
    union all {{ acs_share('acs_rental_vacancy_rate', ['B25004_002'],
                           ['B25003_003', 'B25004_003', 'B25004_002'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_homeowner_vacancy_rate', ['B25004_004'],
                           ['B25003_002', 'B25004_005', 'B25004_004'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_vacant_seasonal_share', ['B25004_006'], ['B25004_001'], relation='vacancy_keyed') }}
    -- "Other vacant": neither for rent, for sale, sold or rented, seasonal nor migrant —
    -- homes being repaired, in probate or foreclosure, or abandoned.
    union all {{ acs_share('acs_vacant_other_share', ['B25004_008'], ['B25004_001'], relation='vacancy_keyed') }}
    -- Heating fuel, among occupied homes.
    union all {{ acs_share('acs_heat_gas_share', ['B25040_002'], ['B25040_001'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_heat_electric_share', ['B25040_004'], ['B25040_001'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_heat_oil_share', ['B25040_005'], ['B25040_001'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_heat_propane_share', ['B25040_003'], ['B25040_001'], relation='vacancy_keyed') }}
    union all {{ acs_share('acs_heat_other_share',
                           ['B25040_006', 'B25040_007', 'B25040_008', 'B25040_009', 'B25040_010'],
                           ['B25040_001'], relation='vacancy_keyed') }}
)
select
    'census_acs' as source_id,
    metric_id,
    geoid,
    level,
    make_date(vintage - 4, 1, 1) as period_start,
    make_date(vintage, 12, 31)   as period_end,
    value,
    margin_of_error,
    case when level = 'zip' then 'zcta' else 'fips' end as match_method,
    release_layer,
    vintage::varchar as release_vintage
from unpivoted
where value is not null
