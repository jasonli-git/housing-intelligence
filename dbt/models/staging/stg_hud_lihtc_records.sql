{{ config(materialized='table') }}
with files as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/hud_lihtc/[0-9]*/*.parquet',
                      filename=true, union_by_name=true)
), raw as (
    -- Historical raw releases remain on disk; only the newest bulk file is served.
    select * from files
    where release_vintage::int = (select max(release_vintage::int) from files)
), places as (
    -- Census BPS publishes both place and MCD codes. CDPs without a verified MCD
    -- relationship never become municipalities merely because their names match.
    select distinct lpad(trim(column03), 3, '0') as countyfp,
           lpad(trim(column05), 5, '0') as placefp,
           '34' || lpad(trim(column03), 3, '0')
                || lpad(trim(column06), 5, '0') as town_geoid
    from read_parquet('{{ var("parquet_dir") }}/census_permits/*/place_*.parquet')
    where trim(column01) = '34' and trim(column05) <> '00000'
      and trim(column06) <> '00000'
), unique_places as (
    select countyfp, placefp, min(town_geoid) as town_geoid
    from places group by 1, 2 having count(distinct town_geoid) = 1
), located as (
    select r.*, case when try_cast(cnty2020 as int) between 1 and 41
                              and try_cast(cnty2020 as int) % 2 = 1
                    then '34' || lpad(cnty2020, 3, '0') end as county_geoid,
           p.town_geoid
    from raw r left join unique_places p
      on p.countyfp = lpad(r.cnty2020, 3, '0')
     and p.placefp = lpad(r.place2020, 5, '0')
)
select 'hud_lihtc' as source_id, HUD_ID as record_id,
       coalesce(i.geoid, county_geoid, '34') as geoid,
       case when i.geoid is not null then 'municipality'
            when county_geoid is not null then 'county' else 'state' end as level,
       'lihtc_property' as kind,
       to_json(struct_pack(
           name := PROJECT, address := PROJ_ADD, city := PROJ_CTY, zip := PROJ_ZIP,
           units := n_units, low_income_units := li_units,
           bedrooms := map(['0','1','2','3','4'], [n_0br,n_1br,n_2br,n_3br,n_4br]),
           placed_in_service := case when try_cast(YR_PIS as int) between 1987 and 2100
                                     then try_cast(YR_PIS as int) end,
           targeted_seniors := TRGT_ELD = '1', targeted_disability := TRGT_DIS = '1',
           service_year_status := case when yr_pis = '8888' then 'unconfirmed'
               when yr_pis = '9999' then 'year unknown'
               when try_cast(yr_pis as int) > coverage_through
                    and try_cast(yr_pis as int) <= 2100 then 'after coverage year'
               when try_cast(yr_pis as int) between 1987 and coverage_through
                    then 'within coverage' else 'not reported' end,
           no_longer_monitored := case when nonprog = '1' then true
                                      when nonprog = '2' then false end,
           affordability_years := aff_yrs,
           resyndicated := case when resyndication_cd = '1' then true
                               when resyndication_cd = '2' then false end,
           coverage_through := coverage_through, notes := DATANOTE,
           location_scope := case when i.geoid is not null then 'municipality'
                                  when county_geoid is not null then 'county'
                                  else 'state only; county not located' end,
           location_method := case when i.geoid is not null then 'census_place_to_mcd'
                                   when county_geoid is not null then 'publisher_county'
                                   else 'publisher_state' end
       )) as payload,
       make_date(coverage_through, 12, 31) as snapshot,
       'properties' as release_layer, release_vintage
from located r
left join {{ ref('stg_nj_municipal_codes') }} i on i.geoid = r.town_geoid
