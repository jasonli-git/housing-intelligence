-- Reading the ACS's landed layers (Milestone 34).

-- One request layer at every level it was fetched at — county, county subdivision and,
-- from the 2020 edition, ZCTA — each row keyed to the region it describes. `prefix` is
-- the adapter's layer prefix ('' for the first request, 'housing_', 'rent_', ...), so
-- `release_layer` names the file each row came from. ZCTA rows are `zip` regions: the
-- ZCTA's code is the region's geoid, and the caveat that a ZCTA is not a ZIP travels
-- with the region level, not with each source.
{% macro acs_layers(prefix) -%}
    select *, 'county' as level, '{{ prefix }}county' as release_layer,
           state || county as geoid,
           regexp_extract(filename, '/(\d{4})/', 1)::int as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/{{ prefix }}county_*.parquet',
                      filename=true, union_by_name=true)
    union all by name
    select *, 'municipality' as level, '{{ prefix }}cousub' as release_layer,
           state || county || "county subdivision" as geoid,
           regexp_extract(filename, '/(\d{4})/', 1)::int as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/{{ prefix }}cousub_*.parquet',
                      filename=true, union_by_name=true)
    -- "County subdivisions not defined" carries subdivision code 00000, exactly as in
    -- TIGER. Same filter, same reason.
    where "county subdivision" <> '00000'
    union all by name
    select *, 'zip' as level, '{{ prefix }}zcta' as release_layer,
           "zip code tabulation area" as geoid,
           regexp_extract(filename, '/(\d{4})/', 1)::int as vintage
    from read_parquet('{{ var("parquet_dir") }}/census_acs/*/{{ prefix }}zcta_*.parquet',
                      filename=true, union_by_name=true)
{%- endmacro %}

-- An estimate as a number, or NULL. Every negative value the ACS publishes in an
-- estimate column is a code (-666666666 too few cases, -999999999 not applicable, ...),
-- never a figure.
{% macro acs_estimate(column) -%}
    case when {{ column }} like '-%' or {{ column }} = '' then null
         else {{ column }}::double end
{%- endmacro %}

-- Each variable's estimate as e_<variable> and margin as m_<variable>. A median whose
-- margin is -333333333 fell in an open-ended bracket, so its estimate is the bracket's
-- bound ("$3,500 or more", "1939 or earlier"), not a median, and is NULL here.
{% macro acs_columns(variables, medians=[]) -%}
    {%- for v in variables %}
    {%- if v in medians %}
    case when "{{ v }}M" = '-333333333' then null
         else {{ acs_estimate('"' ~ v ~ 'E"') }} end as e_{{ v }},
    {%- else %}
    {{ acs_estimate('"' ~ v ~ 'E"') }} as e_{{ v }},
    {%- endif %}
    {{ acs_margin('"' ~ v ~ 'M"') }} as m_{{ v }}{% if not loop.last %},{% endif %}
    {%- endfor %}
{%- endmacro %}

-- A published estimate as a metric, with its own margin.
{% macro acs_level(metric_id, variable, relation='keyed') -%}
    select geoid, level, release_layer, vintage, '{{ metric_id }}' as metric_id,
           e_{{ variable }} as value, m_{{ variable }} as margin_of_error
    from {{ relation }}
{%- endmacro %}

-- A share: the sum of `parts` over the sum of `whole` less the sum of `less`, every
-- part a subset of the whole. Margins by the Census's formulas for a sum and a share.
{% macro acs_share(metric_id, parts, whole, less=[], relation='keyed') -%}
    {%- set x -%}({% for p in parts %}e_{{ p }}{% if not loop.last %} + {% endif %}{% endfor %}){%- endset -%}
    {%- set y -%}({% for p in whole %}e_{{ p }}{% if not loop.last %} + {% endif %}{% endfor %}{% for p in less %} - e_{{ p }}{% endfor %}){%- endset -%}
    select geoid, level, release_layer, vintage, '{{ metric_id }}' as metric_id,
           case when {{ y }} > 0 then {{ x }} / {{ y }} end as value,
           {{ acs_share_margin(x, y,
                               acs_sum_margin(prefixed(parts, 'm_')),
                               acs_sum_margin(prefixed(whole + less, 'm_'))) }}
               as margin_of_error
    from {{ relation }}
{%- endmacro %}

{% macro prefixed(names, prefix) -%}
    {%- set out = [] -%}
    {%- for n in names %}{% do out.append(prefix ~ n) %}{% endfor -%}
    {{ return(out) }}
{%- endmacro %}
