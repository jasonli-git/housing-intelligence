-- FHFA House Price Index, purchase-only seasonally-adjusted, quarterly.
-- State level only: FHFA publishes no county HPI at a reachable URL (see TODO.md), so
-- this is the warehouse's only `state`-level metric.
{{ config(materialized='table') }}

select
    'fhfa_hpi' as source_id,
    'fhfa_hpi' as metric_id,
    -- place_id is the two-letter state code; regions keys states on FIPS.
    case place_id {% for s in var("state_fips_pairs") %}
        when '{{ s[0] }}' then '{{ s[1] }}'{% endfor %}
    end as geoid,
    'state' as level,
    make_date(yr, (period - 1) * 3 + 1, 1) as period_start,
    (make_date(yr, (period - 1) * 3 + 1, 1) + interval 3 month - interval 1 day)::date
        as period_end,
    index_sa::double as value,
    'state_code' as match_method,
    'current' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/fhfa_hpi/current/master.parquet')
where level = 'State'
  and hpi_flavor = 'purchase-only'
  and frequency = 'quarterly'
  and place_id in ({{ var("states") }})
  and index_sa is not null
