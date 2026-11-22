{{ config(materialized='table') }}
-- Where a state without a territory map of its own gets its power (Milestone 63): the
-- counties EIA-861 lists each utility serving (`Service_Territory`), for utilities with
-- residential sales in the state. County precision only: EIA names counties, not the
-- part of one a utility serves, so no share of homes is given and no town or ZIP code
-- is placed. New Jersey keeps NJDEP's territories (`stg_njdep_utility_areas_records`).
with files as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/eia861/[0-9]*/utilities.parquet', filename=true)
), newest as (
    select * from files where release_vintage::int = (select max(release_vintage::int) from files)
), served as (
    select utility_id as eia_id,
           json_extract_string(payload, '$.name') as provider,
           json_extract_string(payload, '$.state') as postal,
           unnest(json_extract_string(payload, '$.counties[*]')) as county_name,
           release_vintage
    from newest
    where json_extract_string(payload, '$.state') <> 'NJ'
), states(postal, fips) as (
    values {% for pair in var('state_fips_pairs') %}('{{ pair[0] }}', '{{ pair[1] }}'){{ ", " if not loop.last }}{% endfor %}
), counties as (
    select STATEFP as fips, GEOID as county_geoid, NAME as county_name
    from read_parquet('{{ var("parquet_dir") }}/census_tiger/*/county.parquet')
)
select 'eia861' as source_id, 'electric_utility' as kind,
       'utility:' || utility_id as entity_id, utility_id as record_id,
       payload, make_date(release_vintage::int, 12, 31) as snapshot,
       'utilities' as release_layer, release_vintage
from newest
union all
select 'eia861' as source_id, 'utility_area' as kind,
       'county:' || c.county_geoid as entity_id,
       'electric:' || s.provider as record_id,
       to_json(struct_pack(fuel := 'electric', provider := s.provider,
           approximate_share := null::double, eia_id := s.eia_id,
           scope := 'county; EIA lists the county, not the part served')) as payload,
       null::date as snapshot, 'utilities' as release_layer, s.release_vintage
from served s
join states st using (postal)
join counties c on c.fips = st.fips and c.county_name = s.county_name
