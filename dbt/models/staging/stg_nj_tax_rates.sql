-- NJ general and effective tax rates, and the Director's Ratio, per municipality.
--
-- Three worksheets landed as three grids of text, unpivoted here into a long series.
-- The grids are shaped alike -- county, CD code and district name, then one column per
-- year running backwards from the newest -- so one unpivot serves all three and the
-- layer comes off the file path.
--
-- **Nothing here is derived.** The Division publishes the effective rate, and this
-- ingests it. That is the owner's decision of 2026-09-19 and it is the right one, because
-- the obvious derivation does not reproduce it: pairing each year's general rate with
-- the *prior* year's Director's Ratio -- the better of the two pairings by an order of
-- magnitude -- lands within 0.5% for only 53% of municipality-years, with a p90 of 7.4%
-- and outliers past 60%. Measured across all 13,001 comparable cells on 2026-09-19;
-- pairing on the same year instead gives a median error of 4.6%. The published
-- effective rate is computed from the abstract of ratables, not from these two numbers,
-- so the ratio is landed beside it as a **check** on the series, never as its input.
-- `tests/test_nj_tax_rates.py` pins that relationship so a column shifting by one year
-- fails loudly instead of quietly restating a different decade.
--
-- **Municipality only.** A county effective rate is a levy-weighted average, and the
-- weights -- equalized valuations per municipality -- are in the Table of Equalized
-- Valuations PDF, not in these workbooks. An unweighted mean across municipalities
-- would be a different and misleading number, so no county rows are emitted. The
-- county-level property tax figure the platform already has is
-- `modiv_median_tax_bill`, which is a bill rather than a rate.
--
-- **567 districts, 564 municipalities.** Pine Valley Borough (0429) merged into Pine
-- Hill in 2022, and Princeton Borough (1109) and Princeton Township (1110) merged into
-- Princeton in 2013. All three are carried for their historical years and are not in
-- `region_identifiers`, so they drop out of the join. That is correct, and it is why a
-- coverage check here counts against 564 rather than against the workbook's row count.
{{ config(materialized='table') }}

with grid as (

    select
        regexp_extract(filename, '/([^/]+)\.parquet$', 1) as layer,
        {{ release_vintage() }} as release_vintage,
        * exclude (filename)
    from read_parquet(
        '{{ var("parquet_dir") }}/nj_tax_rates/*/*.parquet', filename=true
    )

), cells as (

    -- A, B and C are the identifier columns and are carried through rather than
    -- unpivoted; every remaining column is a year whose heading sits in a row above
    -- the data.
    select * from (
        unpivot grid
        on columns(* exclude (layer, release_vintage, A, B, C))
        into name col value cell
    )

), year_map as (

    -- Which spreadsheet column holds which year, found by looking for cells that are
    -- four-digit years rather than by counting header rows -- the rate sheets put
    -- their headings in row 1 and the ratio sheet in row 2. Safe because no rate or
    -- ratio can be a number in this range: rates run 0-10 and ratios 0-200. The
    -- identifier columns are excluded above, which matters because NJ's CD codes 2001
    -- to 2021 would otherwise read as years.
    select distinct layer, col, cell::int as year
    from cells
    where regexp_matches(cell, '^(19|20)[0-9]{2}$')

), observations as (

    select
        c.layer,
        c.release_vintage,
        lpad(trim(c.B), 4, '0') as cd_code,
        y.year,
        try_cast(c.cell as double) as value
    from cells c
    join year_map y
      on y.layer = c.layer and y.col = c.col
    -- Data rows are the ones whose CD code is numeric; every header row fails this.
    where regexp_matches(trim(c.B), '^[0-9]{3,4}$')
      and try_cast(c.cell as double) is not null
      -- A published 0.000 is a year the district had no rate, not a district that
      -- levied nothing: all 16 belong to CD 1114 before it was constituted. Zero is
      -- the one value here that would be read as a fact rather than as a gap.
      and try_cast(c.cell as double) > 0

)

select
    'nj_tax_rates' as source_id,
    case o.layer
        when 'general' then 'nj_general_tax_rate'
        when 'effective' then 'nj_effective_tax_rate'
        else 'nj_director_ratio'
    end as metric_id,
    i.geoid,
    'municipality' as level,
    -- A rate applies to a tax year, which is a calendar year in New Jersey.
    make_date(o.year, 1, 1) as period_start,
    make_date(o.year, 12, 31) as period_end,
    o.value::double as value,
    'nj_cd_code' as match_method,
    o.layer as release_layer,
    o.release_vintage
from observations o
join {{ ref('stg_nj_municipal_codes') }} i
  on i.identifier = o.cd_code
