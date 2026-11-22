{#
  The release layer a per-state file was read under, from a state FIPS expression
  (Milestone 63): New Jersey's keeps the name it had alone, every other state's carries
  its code — the same rule as `hip.sources.base.scoped_layer`.
#}
{% macro scoped_layer(base, fips) -%}
case {{ fips }}
{%- for pair in var('state_fips_pairs') %}
    when '{{ pair[1] }}' then '{{ base if pair[0] == "NJ" else base ~ "_" ~ pair[0] | lower }}'
{%- endfor %}
end
{%- endmacro %}

{#
  The same, for a per-state file named `<layer>_<STATE>.parquet` whose rows carry no
  state of their own (the ACS's ZCTA rows). A file named for no state keeps `base`.
#}
{% macro file_scoped_layer(base, filename) -%}
case regexp_extract({{ filename }}, '_([A-Z]{2})\.parquet$', 1)
{%- for pair in var('state_fips_pairs') %}
    when '{{ pair[0] }}' then '{{ base if pair[0] == "NJ" else base ~ "_" ~ pair[0] | lower }}'
{%- endfor %}
    else '{{ base }}'
end
{%- endmacro %}
