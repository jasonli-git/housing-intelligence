-- Components must remain keyed, dated and independent of ranked housing facts.
with components as (
    select * from {{ ref('stg_nj_school_performance_records') }}
    union all select * from {{ ref('stg_nj_crime_records') }}
    union all select * from {{ ref('stg_cdc_places_records') }}
    union all select * from {{ ref('stg_nj_school_boundaries_records') }}
    union all select * from {{ ref('stg_fcc_bdc_records') }}
    union all select * from {{ ref('stg_fcc_bdc_locations_records') }}
), bad_keys as (
    select source_id,kind,entity_id,record_id
    from components
    group by 1,2,3,4
    having count(*) <> 1 or entity_id is null or record_id is null
), bad_shares as (
    select source_id,kind,entity_id,record_id from components
    where kind='school_area' and (
        json_extract(payload,'$.approximate_share')::double <= 0
        or json_extract(payload,'$.approximate_share')::double > 1
        or json_extract_string(payload,'$.district_type') not in ('unified','elementary','secondary')
    )
)
select * from bad_keys union all select * from bad_shares
union all
-- A place's fiber and unserved locations are among its locations (#372).
select source_id,kind,entity_id,record_id from components
where kind='broadband_place' and (
    json_extract(payload,'$.fiber')::bigint > json_extract(payload,'$.locations')::bigint
    or json_extract(payload,'$.unserved_terrestrial')::bigint
       > json_extract(payload,'$.locations')::bigint
)
union all
select source_id,kind,entity_id,record_id from components
where file_sha256 is null or not regexp_full_match(file_sha256,'[a-f0-9]{64}')
