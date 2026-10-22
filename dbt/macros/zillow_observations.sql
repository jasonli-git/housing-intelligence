{#
  Turn Zillow's wide monthly CSVs into long observations.

  Every Zillow file is identifying columns followed by ~318 date columns, one per month
  since 2000. DuckDB's UNPIVOT reshapes that in one pass.

  Columns are selected by *pattern* rather than by excluding a known identifier list.
  The identifier columns differ per level — ZIP files carry a `City` column that county
  and city files do not — and Zillow adds a date column every month. Matching
  `YYYY-MM-DD` is stable against both: a new identifier column is ignored automatically,
  and a new month is picked up automatically. An exclude-list broke on the first and
  would silently stop importing on the second.

  The three levels still differ in what identifies them, which is the problem this
  milestone had to solve: county files have FIPS, city and ZIP files do not. The macro
  emits a uniform shape and leaves resolution to hip.geography.matching.
#}

{#
  The pattern match has one blind spot: a month column Zillow renamed or reformatted
  (`2025/03/31`) is not a date column to it, so that month would vanish without a word
  (found by tests/test_zillow_unpivot.py, 2026-10-21). The guard refuses the file
  instead: any column that looks like a date but is not `YYYY-MM-DD`, or a gap in the
  run of months, stops the build with the column named. A new identifier column, which
  starts with no digits, is still ignored.
#}
{% macro zillow_guard(path, source_id, layer) %}
    (
        select case
            when count(*) filter (where looks_dated and not is_month) > 0
                then error('{{ source_id }} {{ layer }}: unrecognised month column(s) '
                    || string_agg(name, ', ') filter (where looks_dated and not is_month)
                    || '; Zillow changed its layout, so the file is refused rather than '
                    || 'loaded with months missing')
            when count(*) filter (where is_month) > 0
                and date_diff('month',
                        min(try_strptime(name, '%Y-%m-%d')) filter (where is_month),
                        max(try_strptime(name, '%Y-%m-%d')) filter (where is_month)) + 1
                    <> count(distinct name) filter (where is_month)
                then error('{{ source_id }} {{ layer }}: the month columns have a gap; '
                    || 'the file is refused rather than loaded with months missing')
            else true
        end as layout_ok
        from (
            select
                name,
                regexp_matches(name, '^[0-9]{4}[^0-9a-zA-Z][0-9]{1,2}[^0-9a-zA-Z][0-9]{1,2}$')
                    as looks_dated,
                regexp_matches(name, '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') as is_month
            from parquet_schema('{{ path }}')
        )
    )
{% endmacro %}


{% macro zillow_level(source_id, layer, fips_expr, county_expr) %}
    {%- set path = var("parquet_dir") ~ "/" ~ source_id ~ "/" ~ var("zillow_vintage") ~ "/" ~ layer ~ ".parquet" -%}
    select
        '{{ source_id }}'      as source_id,
        '{{ layer }}'          as layer,
        RegionName             as region_name,
        {{ fips_expr }}        as fips_key,
        {{ county_expr }}      as county_name,
        State                  as state_code,
        strptime(period, '%Y-%m-%d')::date as period_start,
        value
    from (
        unpivot (
            select * from read_parquet(
                '{{ var("parquet_dir") }}/{{ source_id }}/{{ var("zillow_vintage") }}/{{ layer }}.parquet'
            )
            where State in ({{ var("states") }})
        )
        on columns('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        into name period value value
    )
    cross join {{ zillow_guard(path, source_id, layer) }} as guard
    -- Zillow leaves a cell empty wherever a geography had too few transactions that
    -- month. Those are absences, not zeros, and must never become facts.
    where value is not null and guard.layout_ok
{% endmacro %}


{# `zip=false` for a series Zillow publishes for counties and cities only: ZHVI's tiers. #}
{% macro zillow_observations(source_id, zip=true) %}
    {{ zillow_level(source_id, 'county', 'StateCodeFIPS || MunicipalCodeFIPS', 'null') }}

    union all

    {{ zillow_level(source_id, 'city', 'null', 'CountyName') }}
    {%- if zip %}

    union all

    {{ zillow_level(source_id, 'zip', 'null', 'CountyName') }}
    {%- endif %}
{% endmacro %}
