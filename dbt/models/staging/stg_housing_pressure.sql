-- HUD CHAS Table 8, reviewed 2018–2022 layout. Ancillary context, never rankings.
{{ config(materialized='table') }}
with files as (
    select * from read_parquet('{{ var("parquet_dir") }}/hud_chas_bulk/*/*.parquet',filename=true,union_by_name=true)
    where {{ release_vintage('filename') }} = '2018-2022'
), stamps as (
    select regexp_replace(filename,'\.src$','') as filename,
           regexp_replace(content,'\s+','','g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/hud_chas_bulk/*/*.parquet.src')
), municipal as (
    select distinct STATEFP || COUSUBFP as geo_key,GEOID as geoid
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/cousub_*.parquet') where COUSUBFP <> '00000'
), matched as (
    -- A town by its full GEOID where the landed file carries one (Milestone 63: MCD
    -- codes repeat across Pennsylvania's counties), else by state and MCD code, which is
    -- unique in New Jersey, whose file landed before `geoid` was kept.
    select f.*, m.geoid as town_geoid
    from files f
    left join municipal m
      on json['level'] <> 'county'
     and (m.geoid = json['geoid']
          or (json['geoid'] is null and m.geo_key = json['geo_key']))
)
{% for tenure,bands in [('owner',[3,16,29,42,55]),('renter',[69,82,95,108,121])] %}
{% for band in bands %}
select case when json['level']='county' then 'county' else 'municipality' end as level,
       case when json['level']='county' then json['geo_key'] else town_geoid end as geoid,
       '{{ tenure }}' as tenure, {{ loop.index0 }} as band,
       '2018-2022' as vintage,
       case when json['level']='county' then '050' else '060' end as release_layer,
       file_sha256,
       json['T8_est{{ band }}']::double as total,
       json['T8_moe{{ band }}']::double as total_moe,
       json['T8_est{{ band+4 }}']::double + json['T8_est{{ band+7 }}']::double as burdened,
       {{ chas_sum_margin([band+4,band+7]) }} as burdened_moe,
       json['T8_est{{ band+7 }}']::double as severe,
       json['T8_moe{{ band+7 }}']::double as severe_moe,
       json['T8_est{{ band+10 }}']::double as unknown,
       json['T8_moe{{ band+10 }}']::double as unknown_moe
from matched left join stamps using(filename)
-- Keep historical/unmatched MCDs in raw files, never assign them to a current town.
where json['level']='county' or town_geoid is not null
{% if not loop.last or tenure=='owner' %}union all{% endif %}
{% endfor %}
{% endfor %}
