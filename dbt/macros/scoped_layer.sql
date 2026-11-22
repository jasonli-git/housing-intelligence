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
