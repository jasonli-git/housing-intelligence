-- Census Population Estimates Program: headline population as of July 1.
--
-- A different program from ACS and loaded beside it, never instead of it. An ACS
-- 5-year estimate averages five years of sample; a PEP estimate is a single year
-- carried forward from the 2020 census. `acs_population` stays the denominator of
-- every computed ratio, so no ratio mixes the two (see config/metrics.yml).
--
-- Two files land under this source and they are read separately:
--
--   <vintage>/county.parquet      the national file, SUMLEV 040 (state) and 050 (county)
--   <vintage>/cousub_<state>.parquet   one per state, SUMLEV 061 (county subdivision)
--
-- **The SUMLEV filter is what stops double counting.** The sub-county file also holds
-- incorporated places (162) and "balance of" records (071, 157) that overlap the
-- municipalities in 061 -- for New Jersey, 323 places and 667 balance records against
-- 564 municipalities. Reading them all would count the same people several times under
-- different geographies. Only 061 is a municipality in the sense `regions` means.
--
-- Geography is exact: STATE || COUNTY || COUSUB is the same 10-digit GEOID TIGER gives,
-- so this resolves by FIPS with no name matching. Verified 2026-09-19 against the
-- loaded spine -- 564 of 564 municipalities and 21 of 21 counties, none left over.
--
-- The estimate columns are unpivoted rather than taking the newest only: POPESTIMATE
-- runs from the series start to the vintage year, which gives a real annual series a
-- change window can be computed over.
{{ config(materialized='table') }}

with counties as (

    select
        case sumlev when '040' then 'state' else 'county' end as level,
        case sumlev
            when '040' then lpad(state::varchar, 2, '0')
            else lpad(state::varchar, 2, '0') || lpad(county::varchar, 3, '0')
        end as geoid,
        'county' as release_layer,
        {{ release_vintage() }} as release_vintage,
        * exclude (sumlev, state, county)
    from read_parquet(
        '{{ var("parquet_dir") }}/census_pep/*/county.parquet', filename=true
    )
    where sumlev in ('040', '050')
      and lpad(state::varchar, 2, '0') in ({{ var("state_fips") }})

), municipalities as (

    select
        'municipality' as level,
        lpad(state::varchar, 2, '0')
            || lpad(county::varchar, 3, '0')
            || lpad(cousub::varchar, 5, '0') as geoid,
        'cousub' as release_layer,
        {{ release_vintage() }} as release_vintage,
        * exclude (sumlev, state, county, cousub)
    from read_parquet(
        '{{ var("parquet_dir") }}/census_pep/*/cousub_*.parquet', filename=true
    )
    -- 061 only. Places and "balance of" records overlap these municipalities.
    where sumlev = '061'

), combined as (

    -- (?i) because the lander preserves the publisher's header casing and Census ships
    -- these columns uppercase; `columns()` matches names case-sensitively even though
    -- identifiers elsewhere are not.
    select level, geoid, release_layer, release_vintage,
           columns('(?i)^popestimate\d{4}$')
    from counties
    union all by name
    select level, geoid, release_layer, release_vintage,
           columns('(?i)^popestimate\d{4}$')
    from municipalities

), unpivoted as (

    unpivot combined
    on columns('(?i)^popestimate\d{4}$')
    into name estimate_column value population

)

select
    'census_pep' as source_id,
    'pep_population' as metric_id,
    geoid,
    level,
    -- A PEP estimate is as of July 1, not an average over a span, so the period is one
    -- day. An ACS row beside it spans five years, which is the distinction the metric
    -- description exists to keep visible.
    make_date(regexp_extract(estimate_column, '(\d{4})$', 1)::int, 7, 1) as period_start,
    make_date(regexp_extract(estimate_column, '(\d{4})$', 1)::int, 7, 1) as period_end,
    population::double as value,
    'fips' as match_method,
    release_layer,
    release_vintage
from unpivoted
where population is not null
