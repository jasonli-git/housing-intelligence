{{ config(materialized='table') }}
with raw as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/hud_lihtc/*/*.parquet', filename=true)
), located as (
    select *, case when try_cast(CURCNTY as int) between 1 and 41
                             and try_cast(CURCNTY as int) % 2 = 1
                   then '34' || lpad(CURCNTY, 3, '0') end as county_geoid,
           '34' || lpad(CURCNTY, 3, '0') || lpad(CURCOSUB, 5, '0') as town_geoid
    from raw
)
select 'hud_lihtc' as source_id, HUD_ID as record_id,
       coalesce(i.geoid, county_geoid, '34') as geoid,
       case when i.geoid is not null then 'municipality'
            when county_geoid is not null then 'county' else 'state' end as level,
       'lihtc_property' as kind,
       to_json(struct_pack(
           name := PROJECT, address := PROJ_ADD, city := PROJ_CTY, zip := PROJ_ZIP,
           units := case when N_UNITS >= 0 then N_UNITS end,
           low_income_units := case when LI_UNITS >= 0 then LI_UNITS end,
           bedrooms := map(['0','1','2','3','4'],
               [case when N_0BR >= 0 then N_0BR end,
                case when N_1BR >= 0 then N_1BR end,
                case when N_2BR >= 0 then N_2BR end,
                case when N_3BR >= 0 then N_3BR end,
                case when N_4BR >= 0 then N_4BR end]),
           placed_in_service := case when try_cast(YR_PIS as int) between 1987 and 2100
                                     then try_cast(YR_PIS as int) end,
           targeted_seniors := TRGT_ELD = '1', targeted_disability := TRGT_DIS = '1',
           coverage_through := 2020, notes := DATANOTE,
           location_scope := case when i.geoid is not null then 'municipality'
                                  when county_geoid is not null then 'county'
                                  else 'state only; county not located' end
       )) as payload,
       date '2020-12-31' as snapshot, 'properties' as release_layer, release_vintage
from located r
left join {{ ref('stg_nj_municipal_codes') }} i on i.geoid = r.town_geoid
