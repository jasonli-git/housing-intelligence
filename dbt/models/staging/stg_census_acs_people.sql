-- The people and households, from the ACS in depth (Milestone 34): how workers get to
-- work and how long it takes, who households are, and disability — at county,
-- municipality and ZCTA, each with its margin of error. Reads the `people_` and
-- `disability_` layers.
{{ config(materialized='table') }}

{%- set people = ['B08301_001', 'B08301_003', 'B08301_010', 'B08301_019', 'B08301_021',
                  'B08013_001', 'B08303_001', 'B08303_013',
                  'B11001_001', 'B11001_003', 'B11001_008',
                  'B11005_001', 'B11005_002'] %}
{%- set disabled = ['B18101_004', 'B18101_007', 'B18101_010', 'B18101_013', 'B18101_016',
                    'B18101_019', 'B18101_023', 'B18101_026', 'B18101_029', 'B18101_032',
                    'B18101_035', 'B18101_038'] %}

with people_keyed as (
    select geoid, level, release_layer, vintage,
           {{ acs_columns(people) }}
    from ({{ acs_layers('people_') }})
),
disability_keyed as (
    select geoid, level, release_layer, vintage,
           {{ acs_columns(['B18101_001'] + disabled) }}
    from ({{ acs_layers('disability_') }})
),
unpivoted as (
    -- Workers 16 and over, by how they usually got to work in the survey week.
    {{ acs_share('acs_commute_transit_share', ['B08301_010'], ['B08301_001'], relation='people_keyed') }}
    union all {{ acs_share('acs_work_from_home_share', ['B08301_021'], ['B08301_001'], relation='people_keyed') }}
    union all {{ acs_share('acs_commute_drove_alone_share', ['B08301_003'], ['B08301_001'], relation='people_keyed') }}
    union all {{ acs_share('acs_commute_walked_share', ['B08301_019'], ['B08301_001'], relation='people_keyed') }}
    -- Minutes each way for those who travel to work: the Census's aggregate minutes over
    -- the workers who did not work from home, which is B08303's universe. A mean, not the
    -- median, because the Census publishes the aggregate and not the median.
    union all
    select geoid, level, release_layer, vintage, 'acs_mean_commute_minutes',
           case when e_B08303_001 > 0 then e_B08013_001 / e_B08303_001 end,
           {{ acs_ratio_margin('e_B08013_001', 'e_B08303_001', 'm_B08013_001', 'm_B08303_001') }}
    from people_keyed
    union all {{ acs_share('acs_commute_60plus_share', ['B08303_013'], ['B08303_001'], relation='people_keyed') }}
    -- Households.
    union all {{ acs_share('acs_living_alone_share', ['B11001_008'], ['B11001_001'], relation='people_keyed') }}
    union all {{ acs_share('acs_married_couple_share', ['B11001_003'], ['B11001_001'], relation='people_keyed') }}
    union all {{ acs_share('acs_with_children_share', ['B11005_002'], ['B11005_001'], relation='people_keyed') }}
    -- Any of the six difficulties the survey asks about — hearing, vision, cognition,
    -- walking, self-care, living independently — among people not in an institution.
    union all {{ acs_share('acs_disability_share', disabled, ['B18101_001'], relation='disability_keyed') }}
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
