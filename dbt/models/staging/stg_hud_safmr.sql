-- HUD Small Area Fair Market Rents by ZIP (Milestone 35): the rent standard HUD sets ZIP
-- by ZIP in some metro areas, nine New Jersey counties in FY2026, studio to four
-- bedrooms. A ZIP listed under two counties of one metro carries one figure, so one row
-- is kept per ZIP and year. Keyed to `zip` regions by the ZIP's own code, the way Zillow's
-- ZIP files are.
{{ config(materialized='table') }}

{%- set sizes = {
    'hud_safmr_0br': 'efficiency',
    'hud_safmr_1br': 'one_bedroom',
    'hud_safmr_2br': 'two_bedroom',
    'hud_safmr_3br': 'three_bedroom',
    'hud_safmr_4br': 'four_bedroom',
} %}

with raw as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/hud_fmr/*/safmr_*.parquet',
                      filename=true, union_by_name=true)
),
one as (
    -- The lowest county code wins a ZIP HUD lists twice, so the cited release is stable.
    select * from raw
    qualify row_number() over (
        partition by zip_code, fiscal_year order by county_fips
    ) = 1
)
{%- for metric_id, column in sizes.items() %}
select
    'hud_fmr' as source_id,
    '{{ metric_id }}' as metric_id,
    zip_code as geoid,
    'zip' as level,
    make_date(fiscal_year::int - 1, 10, 1) as period_start,
    make_date(fiscal_year::int, 9, 30) as period_end,
    {{ column }}::double as value,
    'zip_code' as match_method,
    'safmr_' || county_fips as release_layer,
    release_vintage
from one
where {{ column }} is not null
{%- if not loop.last %}
union all
{%- endif %}
{%- endfor %}
