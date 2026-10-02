-- County and statewide effective tax rates (Milestone 37): each town's effective rate
-- weighted by its equalized valuation from the state's Table of Equalized Valuations,
-- which is what a levy over a value comes to when several towns are taken together —
-- never the towns' plain average (ARCHITECTURE #290). Closes the asymmetry #181 left: a
-- county page had a typical tax bill and no rate.
--
-- A tax year's effective rate is the general rate times the Director's Ratio of the
-- table certified the October before: Absecon's 2025 rate, 2.410, is its 3.517 general
-- rate at the 2024 table's 68.62%. So rate year Y is weighted by table Y - 1, whose
-- equalized values are the true values that rate was set against.
--
-- A year is published for a county only when every one of its towns has both a rate
-- and an equalized value; a county rate weighted over some of its towns would be a
-- different county's rate.
{{ config(materialized='table') }}

with rates as (
    select geoid, year(period_end) as tax_year, value as effective_rate, release_vintage
    from {{ ref('stg_nj_tax_rates') }}
    where metric_id = 'nj_effective_tax_rate'
),
equalized as (
    select i.geoid, t.tax_year::int + 1 as tax_year, t.equalized_value::double as equalized,
           '34' || lpad((2 * substr(t.cd_code, 1, 2)::int - 1)::varchar, 3, '0')
               as county_geoid
    from read_parquet('{{ var("parquet_dir") }}/nj_equalized/*/tev.parquet') t
    join {{ ref('stg_nj_municipal_codes') }} i on i.identifier = t.cd_code
    where t.equalized_value > 0
),
joined as (
    select e.county_geoid, e.tax_year, e.equalized, r.effective_rate, r.release_vintage
    from equalized e
    left join rates r on r.geoid = e.geoid and r.tax_year = e.tax_year
),
levelled as (
    select county_geoid as geoid, 'county' as level, * exclude (county_geoid) from joined
    union all
    select '34', 'state', * exclude (county_geoid) from joined
),
weighted as (
    select geoid, level, tax_year,
           sum(effective_rate * equalized) / sum(equalized) as value,
           count(*) as towns,
           count(effective_rate) as rated,
           max(release_vintage) as release_vintage
    from levelled
    group by 1, 2, 3
)
select
    'nj_tax_rates' as source_id,
    'nj_effective_tax_rate' as metric_id,
    geoid,
    level,
    make_date(tax_year, 1, 1) as period_start,
    make_date(tax_year, 12, 31) as period_end,
    value,
    'fips' as match_method,
    -- Cites the rate workbook, whose figures these are; the weights are the Table's.
    'effective' as release_layer,
    release_vintage
from weighted
where towns = rated
