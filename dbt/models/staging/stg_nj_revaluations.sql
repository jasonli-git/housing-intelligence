-- New Jersey's approved revaluations and reassessments (Milestone 36): one observation
-- per town per tax year the Division of Taxation recognized one in, 2017 on. The town's
-- latest is its last revaluation the lists record; a town in none has had none since
-- 2017, which the page says rather than leaving blank (ARCHITECTURE #287).
--
-- Keyed on the CD code through `stg_nj_municipal_codes`, with no name matching. A code
-- the lists print twice in one year counts once.
{{ config(materialized='table') }}

with lists as (
    select distinct cd_code, tax_year::int as tax_year,
           {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/nj_revaluations/*/approved.parquet',
                      filename=true)
)
select
    'nj_revaluations' as source_id,
    'nj_revaluation_year' as metric_id,
    i.geoid,
    'municipality' as level,
    make_date(l.tax_year, 1, 1) as period_start,
    make_date(l.tax_year, 12, 31) as period_end,
    l.tax_year::double as value,
    'nj_cd_code' as match_method,
    'approved' as release_layer,
    l.release_vintage
from lists l
join {{ ref('stg_nj_municipal_codes') }} i on i.identifier = l.cd_code
