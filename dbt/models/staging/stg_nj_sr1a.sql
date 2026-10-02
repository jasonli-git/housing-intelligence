-- NJ SR1A deeds aggregated to a typical sale price per municipality, county and state.
--
-- 1.4M recorded deeds in; a rolling three-year median out. This is the platform's first
-- **transaction** price: Zillow's ZHVI is a model of what homes are worth, the ACS's
-- value is what owners say their home is worth, and this is what buyers actually paid.
-- All three can be right at once and they are not interchangeable (SPEC principle 11),
-- so this sits beside them rather than replacing either.
--
-- **The filter is the state's, not ours.** `un_type` is the Division of Taxation's own
-- usability determination for sales-ratio purposes, and a non-usable deed additionally
-- carries one of 33 `sr_nu_code` categories -- inheritances, transfers between
-- relatives, sheriff's sales, corrective deeds. Keeping only `U` is why no threshold
-- here has to guess at what a real sale looks like. For contrast, MOD-IV's sale columns
-- carry no such flag and 397,155 class-2 parcels there record a sale price of exactly
-- $1; see `hip.sources.nj_sr1a` for why that source cannot do this job.
--
-- **Three years, not one.** A median needs a sample. Over a single year 461 of 564
-- municipalities clear 20 usable class-2 sales; over three years 529 do, and the median
-- municipality's sample goes from 58 sales to 174. The same trade the ACS makes with
-- its 5-year estimates, and the period columns say so rather than implying a point in
-- time.
--
-- Counties and the state aggregate from deeds, never from municipal medians -- a median
-- of medians is a different number, and ARCHITECTURE #141 made the same choice for the
-- tax bill. The county half of the CD code resolves by arithmetic (FIPS = 2*code - 1),
-- so only municipalities need the identifier table, and none of it needs a name.
{{ config(materialized='table') }}

with deeds as (

    select
        lpad(county_code, 2, '0') || lpad(district_code, 2, '0') as cd_code,
        '34' || lpad((2 * county_code::int - 1)::varchar, 3, '0') as county_geoid,
        verified_sales_price::bigint as price,
        -- Milestone 36. Year built and living area are filled for 97% and 96% of usable
        -- class-2 deeds; a blank or a zero is unknown, never a figure.
        case when try_cast(year_built as int) between 1700 and 2026
             then try_cast(year_built as int) end as year_built,
        case when try_cast(living_space as int) > 0
             then try_cast(living_space as int) end as living_area,
        -- The Division's own sales ratio, assessed value over price, printed as a
        -- percentage with two implied decimals ("08558" is 85.58%). Not recomputed
        -- from `assessed_value_total`, which reads differently before the 2025 archive
        -- (a median of $142,400 against $268,900 after) — ARCHITECTURE #288.
        case when try_cast(sales_ratio as double) > 0
             then try_cast(sales_ratio as double) / 10000 end as sales_ratio,
        -- YYMMDD with a two-digit year. Every published archive is 2020 or later and
        -- the observed prefixes run 18 to 26, so the pivot is never exercised in
        -- practice -- but a deed can be recorded decades after it is signed, and
        -- reading a 1985 deed as 2085 would put a sale in the future.
        make_date(
            case when substr(deed_date, 1, 2) > '50' then 1900 else 2000 end
                + substr(deed_date, 1, 2)::int,
            substr(deed_date, 3, 2)::int,
            substr(deed_date, 5, 2)::int
        ) as deed_on,
        {{ release_vintage() }} as release_vintage,
        -- The year of the archive a deed was filed in, which bounds when it can have
        -- been signed. `2026ytd` is the year in progress.
        replace({{ release_vintage() }}, 'ytd', '')::int as archive_year
    from read_parquet(
        '{{ var("parquet_dir") }}/nj_sr1a/*/sales.parquet', filename=true
    )
    where un_type = 'U'
      -- Class 2 is one- to four-family residential, the same class every other MOD-IV
      -- aggregate uses, so the price and the tax bill describe the same housing.
      and property_class = '2'
      and regexp_matches(verified_sales_price, '^[0-9]+$')
      and verified_sales_price::bigint > 0
      and regexp_matches(deed_date, '^[0-9]{6}$')
      and substr(deed_date, 3, 2) between '01' and '12'
      and substr(deed_date, 5, 2) between '01' and '31'

), dated as (

    -- A deed cannot be signed after the archive that reports it. Six-digit dates are
    -- keyed by hand and a slipped digit puts a sale in the future: without this the
    -- source yielded deed years through 2028 and opened a window ending there.
    -- Checking against each file's own year needs no calendar and no constant.
    select * exclude (archive_year) from deeds where year(deed_on) <= archive_year

), bounds as (

    -- The last deed the source actually carries. A window ending in the current year is
    -- only filled to here, and saying so is the difference between a period that is
    -- true and one that is merely tidy.
    select max(deed_on) as latest_deed, min(year(deed_on)) as earliest_deed_year
    from dated

), windows as (

    -- One row per (place, end year) pair a three-year window can close on. Generated
    -- from the data rather than declared, so a new archive extends the series without
    -- an edit here.
    select distinct year(deed_on) as end_year
    from dated
    -- Only windows every year of which the source fully covers. The oldest archive is
    -- 2020, so a deed dated 2019 is in the data only if it was recorded a year or more
    -- late -- a biased sample of 2019, and one a median would report as fact. Derived
    -- from the archives present rather than declared, so adding an older file extends
    -- the series by itself.
    where year(deed_on) - 2 >= (select min(replace(release_vintage, 'ytd', '')::int)
                                from dated)

), located as (

    select d.*, i.geoid as municipality_geoid
    from dated d
    left join {{ ref('stg_nj_municipal_codes') }} i
      on i.identifier = d.cd_code

), levelled as (

    -- One deed counts once at each level it belongs to. A municipality row needs the
    -- identifier table; a county row does not, because the county half of the CD code
    -- is arithmetic -- so the ten municipalities whose names never matched still reach
    -- their county's median, exactly as ARCHITECTURE #141 describes for the tax bill.
    select price, year_built, living_area, sales_ratio, deed_on, release_vintage,
           municipality_geoid as geoid, 'municipality' as level
    from located where municipality_geoid is not null
    union all
    select price, year_built, living_area, sales_ratio, deed_on, release_vintage,
           county_geoid, 'county' from located
    union all
    select price, year_built, living_area, sales_ratio, deed_on, release_vintage,
           '34', 'state' from located

), placed as (

    select l.price, l.year_built, l.living_area, l.sales_ratio, l.release_vintage,
           l.geoid, l.level, w.end_year
    from levelled l
    join windows w
      on year(l.deed_on) between w.end_year - 2 and w.end_year

), aggregated as (

    select
        geoid,
        level,
        end_year,
        count(*) as sales,
        median(price) as median_price,
        -- Milestone 36: the spread, the age of what sold, price per square foot where
        -- living area is filled in (with its own count, which must clear the same bar),
        -- and the state's sales ratio. Every one from the deeds at its own level, never
        -- from the level below (ARCHITECTURE #288).
        -- Discrete quartiles: a price someone actually paid, not one between two sales.
        quantile_disc(price, 0.25) as price_q1,
        quantile_disc(price, 0.75) as price_q3,
        median(year_built) as median_year_built,
        median(price::double / living_area) as price_per_sqft,
        count(living_area) as sqft_sales,
        median(sales_ratio) as sales_ratio,
        max(release_vintage) as release_vintage
    from placed
    group by 1, 2, 3

), recent as (

    -- The last twelve months of deeds, where a place has the sales to say something
    -- about them alone: fresher than the three-year window, and noisier, so the bar is
    -- 50 sales rather than 20.
    select l.geoid, l.level, count(*) as sales, median(l.price) as median_price,
           max(l.release_vintage) as release_vintage
    from levelled l cross join bounds b
    where l.deed_on > b.latest_deed - interval 12 month
    group by 1, 2
    having count(*) >= 50

), measured as (

    select geoid, level, end_year, 'sr1a_median_sale_price' as metric_id,
           median_price::double as value, sales, release_vintage from aggregated
    union all
    select geoid, level, end_year, 'sr1a_sales_count', sales, sales, release_vintage
    from aggregated
    union all
    select geoid, level, end_year, 'sr1a_price_lower_quartile', price_q1, sales,
           release_vintage from aggregated
    union all
    select geoid, level, end_year, 'sr1a_price_upper_quartile', price_q3, sales,
           release_vintage from aggregated
    union all
    select geoid, level, end_year, 'sr1a_median_year_built_sold', median_year_built,
           sales, release_vintage from aggregated where median_year_built is not null
    union all
    select geoid, level, end_year, 'sr1a_median_price_per_sqft', price_per_sqft,
           sqft_sales, release_vintage from aggregated
    union all
    select geoid, level, end_year, 'sr1a_median_sales_ratio', sales_ratio, sales,
           release_vintage from aggregated where sales_ratio is not null

)

select
    'nj_sr1a' as source_id,
    m.metric_id,
    m.geoid,
    m.level,
    make_date(m.end_year - 2, 1, 1) as period_start,
    -- Never claims a date the data does not reach. For a closed year this is 31
    -- December; for the year in progress it is the newest deed on file.
    least(make_date(m.end_year, 12, 31), b.latest_deed) as period_end,
    m.value::double as value,
    'nj_cd_code' as match_method,
    'sales' as release_layer,
    m.release_vintage
from measured m
cross join bounds b
-- Below 20 usable sales a median is an anecdote. Suppressed rather than published with
-- a caveat, because a figure on a page is read whether or not its caveat is. For price
-- per square foot the count is of sales with living area filled in.
where m.sales >= 20
union all
-- The last twelve months, dated as exactly that span.
select
    'nj_sr1a',
    'sr1a_median_sale_price_12m',
    r.geoid,
    r.level,
    (b.latest_deed - interval 12 month + interval 1 day)::date,
    b.latest_deed,
    r.median_price::double,
    'nj_cd_code',
    'sales',
    r.release_vintage
from recent r
cross join bounds b
