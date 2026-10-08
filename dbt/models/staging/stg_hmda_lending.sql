-- What financing buyers used, per county, municipality, ZIP code and the state, by year
-- (Milestone 48, ARCHITECTURE #324-#325), from `stg_hmda_loans`.
--
-- Counties and the state count their own tracts' loans exactly. HMDA places a loan in a
-- tract, not a town, so a town's or ZIP's figures weigh each tract's loans by the share
-- of the tract's 2020 homes in it (`stg_block_homes`), the weights the flood shares use
-- (#301): an estimate, labelled `tract_homes`. Medians are weighted medians.
--
-- Published only where the figure stands on enough: 30 loans made for the loan
-- figures, 30 decided applications for the denial rate, 20 denials for their reasons.
{{ config(materialized='table') }}

with weights as (
    select left(block_geoid, 11) as tract, municipality_geoid, zcta_geoid, homes
    from {{ ref('stg_block_homes') }}
),
tract_homes as (select tract, sum(homes) as homes from weights group by 1),
shares as (
    select w.tract, 'municipality' as level, w.municipality_geoid as geoid,
           sum(w.homes) / any_value(t.homes) as w
    from weights w join tract_homes t using (tract)
    where w.municipality_geoid is not null group by 1, 2, 3
    union all
    select w.tract, 'zip', w.zcta_geoid, sum(w.homes) / any_value(t.homes)
    from weights w join tract_homes t using (tract)
    where w.zcta_geoid is not null group by 1, 2, 3
),
placed as (
    select l.*, 'county' as level, l.county as geoid, 1.0 as w,
           'fips' as match_method
    from {{ ref('stg_hmda_loans') }} l
    union all
    select l.*, 'state', '34', 1.0, 'fips' from {{ ref('stg_hmda_loans') }} l
    union all
    select l.*, s.level, s.geoid, s.w, 'tract_homes'
    from {{ ref('stg_hmda_loans') }} l join shares s using (tract)
),
-- Weighted median: the first value at which half the weight is reached.
--
-- In exact decimals, over every row tied at a value at once (a RANGE frame, not ROWS).
-- Summed as doubles row by row, the running weight depended on the order rows arrived
-- in, and a median sitting exactly at half the weight flipped between two rates on a
-- reload over unchanged files: a ZIP's 2023 rate moved from 6.75 to 6.825 on
-- 2026-10-07 (Milestone 51).
medians as (
    select year, level, geoid, metric_id, min(value) as value
    from (
        select year, level, geoid, metric_id, value,
               sum(w::decimal(38, 12)) over (
                   partition by year, level, geoid, metric_id order by value
                   range between unbounded preceding and current row
               ) as running,
               sum(w::decimal(38, 12)) over (
                   partition by year, level, geoid, metric_id
               ) as total
        from placed,
             lateral (values ('hmda_median_rate', interest_rate),
                             ('hmda_median_loan_amount', loan_amount),
                             ('hmda_median_ltv', ltv),
                             ('hmda_median_loan_costs', loan_costs),
                             ('hmda_median_income', income)) as v(metric_id, value)
        where action_taken = '1' and value is not null and value > 0
    )
    where running >= total / 2
    group by all
),
-- Exact sums for the same reason as the medians: summed as doubles, the counts and
-- shares moved in their last digits on every rebuild.
counts as (
    select year, level, geoid, any_value(match_method) as match_method,
           sum(w::decimal(38, 12)) filter (where action_taken = '1') as made,
           sum(w::decimal(38, 12)) filter (where action_taken in ('1', '2', '3')) as decided,
           sum(w::decimal(38, 12)) filter (where action_taken = '3') as denied,
           sum(w::decimal(38, 12)) filter (where action_taken = '1' and loan_type = '1') as conventional,
           sum(w::decimal(38, 12)) filter (where action_taken = '1' and loan_type = '2') as fha,
           sum(w::decimal(38, 12)) filter (where action_taken = '1' and loan_type = '3') as va,
           sum(w::decimal(38, 12)) filter (where action_taken = '3' and denial_reason = '1') as for_dti,
           sum(w::decimal(38, 12)) filter (where action_taken = '3' and denial_reason = '4') as for_value,
           sum(w::decimal(38, 12)) filter (where action_taken = '3' and denial_reason = '3') as for_credit
    from placed group by 1, 2, 3
),
long as (
    select c.year, c.level, c.geoid, c.match_method, v.metric_id, v.value
    from counts c,
         lateral (values
             ('hmda_purchase_loans', c.made, c.made >= 30),
             ('hmda_conventional_share', coalesce(c.conventional, 0) / c.made, c.made >= 30),
             ('hmda_fha_share', coalesce(c.fha, 0) / c.made, c.made >= 30),
             ('hmda_va_share', coalesce(c.va, 0) / c.made, c.made >= 30),
             ('hmda_denial_rate', coalesce(c.denied, 0) / c.decided, c.decided >= 30),
             ('hmda_denial_dti_share', coalesce(c.for_dti, 0) / c.denied, c.denied >= 20),
             ('hmda_denial_value_share', coalesce(c.for_value, 0) / c.denied, c.denied >= 20),
             ('hmda_denial_credit_share', coalesce(c.for_credit, 0) / c.denied, c.denied >= 20)
         ) as v(metric_id, value, enough)
    where v.enough
    union all
    select m.year, m.level, m.geoid, c.match_method, m.metric_id, m.value
    from medians m join counts c using (year, level, geoid)
    where c.made >= 30
)
select 'ffiec_hmda' as source_id, metric_id, geoid, level,
       make_date(year, 1, 1) as period_start, make_date(year, 12, 31) as period_end,
       value::double as value, match_method, 'nj_' || year as release_layer,
       year::varchar as release_vintage
from long
