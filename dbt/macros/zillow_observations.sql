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

{% macro zillow_level(source_id, layer, fips_expr, county_expr) %}
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
    -- Zillow leaves a cell empty wherever a geography had too few transactions that
    -- month. Those are absences, not zeros, and must never become facts.
    where value is not null
{% endmacro %}


{% macro zillow_observations(source_id) %}
    {{ zillow_level(source_id, 'county', 'StateCodeFIPS || MunicipalCodeFIPS', 'null') }}

    union all

    {{ zillow_level(source_id, 'city', 'null', 'CountyName') }}

    union all

    {{ zillow_level(source_id, 'zip', 'null', 'CountyName') }}
{% endmacro %}
