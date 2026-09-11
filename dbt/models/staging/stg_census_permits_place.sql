-- Census Building Permits Survey by place (Milestone 21): residential units authorized,
-- annual, per municipality. Positional like the county file, one Census region per file;
-- the names below are from its two skipped header rows (0-based: 01 state, 03 county,
-- 06 FIPS MCD, 16 place name, then units at 18, 21, 24 and 27).
--
-- In New Jersey every permit-issuing place is a municipality, and state, county and
-- FIPS MCD code make its GEOID exactly. A place without an MCD code (00000) is not a
-- county subdivision; none occur in NJ, and one elsewhere is left out rather than
-- matched by name.
{{ config(materialized='table') }}

select
    'census_permits' as source_id,
    'permits_total_units' as metric_id,
    lpad(trim(column01::varchar), 2, '0')
        || lpad(trim(column03::varchar), 3, '0')
        || lpad(trim(column06::varchar), 5, '0') as geoid,
    'municipality' as level,
    make_date({{ release_vintage() }}::int, 1, 1) as period_start,
    make_date({{ release_vintage() }}::int, 12, 31) as period_end,
    -- Units across all structure sizes, reported plus imputed, as the county model
    -- counts them: 1-unit, 2-unit, 3-4 unit, 5+ unit. Columns 30 onward repeat the four
    -- groups for reported permits only.
    (column18::double + column21::double + column24::double + column27::double) as value,
    'fips' as match_method,
    'place' as release_layer,
    {{ release_vintage() }} as release_vintage
from read_parquet(
    '{{ var("parquet_dir") }}/census_permits/*/place_*.parquet', filename=true
)
where lpad(trim(column01::varchar), 2, '0') in ({{ var("state_fips") }})
  and lpad(trim(column06::varchar), 5, '0') <> '00000'
