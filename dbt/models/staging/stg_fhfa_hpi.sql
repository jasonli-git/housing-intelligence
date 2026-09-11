-- FHFA House Price Index, state level, quarterly — two flavors from the one master file.
--
-- `fhfa_hpi` is purchase-only and seasonally adjusted, from 1991. The all-transactions
-- index (Milestone 21) adds appraisals from refinances and reaches back to 1975, but is
-- published unadjusted only, so the two are separate metrics rather than one series
-- spliced from two methods. It is the series FRED republishes as NJSTHPI; reading it here
-- keeps one source and one release for FHFA's numbers instead of two.
--
-- State level only: FHFA publishes no county HPI at a reachable URL (see TODO.md), so
-- these are the warehouse's only `state`-level metrics.
{{ config(materialized='table') }}

with flavors as (
    select 'fhfa_hpi' as metric_id, *, index_sa::double as value
    from read_parquet('{{ var("parquet_dir") }}/fhfa_hpi/current/master.parquet')
    where hpi_flavor = 'purchase-only'
    union all
    select 'fhfa_hpi_all_transactions', *, index_nsa::double
    from read_parquet('{{ var("parquet_dir") }}/fhfa_hpi/current/master.parquet')
    where hpi_flavor = 'all-transactions'
)
select
    'fhfa_hpi' as source_id,
    metric_id,
    -- place_id is the two-letter state code; regions keys states on FIPS.
    case place_id {% for s in var("state_fips_pairs") %}
        when '{{ s[0] }}' then '{{ s[1] }}'{% endfor %}
    end as geoid,
    'state' as level,
    make_date(yr, (period - 1) * 3 + 1, 1) as period_start,
    (make_date(yr, (period - 1) * 3 + 1, 1) + interval 3 month - interval 1 day)::date
        as period_end,
    value,
    'state_code' as match_method,
    -- The combined `hpi_master.csv` is the only release this source has.
    'master' as release_layer,
    'current' as release_vintage
from flavors
where level = 'State'
  and frequency = 'quarterly'
  and place_id in ({{ var("states") }})
  and value is not null
