-- Census Building Permits Survey: residential units authorized, annual, by county.
-- The source has two header rows plus a blank line, so columns are positional; the
-- names below are from the header rows the lander skipped.
--
-- County files land as `<year>/<year>.parquet`; `????.parquet` reads exactly those and
-- not the place files beside them (`place_<region>.parquet`, Milestone 21), whose
-- columns differ — stg_census_permits_place reads those.
{{ config(materialized='table') }}

select
    'census_permits' as source_id,
    'permits_total_units' as metric_id,
    lpad(column01::varchar, 2, '0') || lpad(column02::varchar, 3, '0') as geoid,
    'county' as level,
    make_date(regexp_extract(filename, '/(\d{4})/', 1)::int, 1, 1) as period_start,
    make_date(regexp_extract(filename, '/(\d{4})/', 1)::int, 12, 31) as period_end,
    -- Units across all structure sizes: 1-unit, 2-unit, 3-4 unit, 5+ unit.
    (column07 + column10 + column13 + column16)::double as value,
    'fips' as match_method,
    -- One annual file per year, so the layer and the vintage are both the year.
    {{ release_vintage() }} as release_layer,
    {{ release_vintage() }} as release_vintage
from read_parquet('{{ var("parquet_dir") }}/census_permits/*/????.parquet', filename=true)
where lpad(column01::varchar, 2, '0') in ({{ var("state_fips") }})
