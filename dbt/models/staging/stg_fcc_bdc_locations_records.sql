{{ config(materialized='table') }}
-- FCC location files counted per 2020 block (hip.sources.fcc.BroadbandLocationsAdapter),
-- placed in towns and ZCTAs by LODES's block crosswalk, as Milestone 45's jobs are.
-- Blocks nest in both, so every count is exact; a block outside every ZCTA (LODES's
-- 99999, water) still counts towards its town, county and the state (ARCHITECTURE #372).
with served as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/fcc_bdc_locations/*/served.parquet',
                      filename = true)
), newest as (
    select max(release_vintage) as release_vintage from served
), fiber as (
    select block, fiber, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/fcc_bdc_locations/*/fiber.parquet',
                      filename = true)
), stamps as (
    select regexp_replace(filename, '\.src$', '') as filename,
           regexp_replace(content, '\s+', '', 'g') as file_sha256
    from read_text('{{ var("parquet_dir") }}/fcc_bdc_locations/*/served.parquet.src')
), xwalk as (
    select tabblk2020 as block, cty as county, ctycsub as town,
           nullif(zcta, '99999') as zcta
    from read_parquet('{{ var("parquet_dir") }}/census_lodes/*/xwalk.parquet',
                      filename = true)
    where regexp_extract(filename, '/census_lodes/(\d{4})/', 1) = (
        select max(regexp_extract(filename, '/census_lodes/(\d{4})/', 1))
        from read_parquet('{{ var("parquet_dir") }}/census_lodes/*/xwalk.parquet',
                          filename = true)
    )
), blocks as (
    select s.block, s.locations, s.unserved_wired, s.unserved_terrestrial,
           coalesce(f.fiber, 0) as fiber,
           -- Placed by the block's own county digits, so an unmatched block is still
           -- counted in its county and the state; it reaches no town or ZIP.
           left(s.block, 5) as county, x.town, x.zcta,
           s.release_vintage, st.file_sha256
    from served s
    join newest using (release_vintage)
    left join fiber f on f.block = s.block and f.release_vintage = s.release_vintage
    left join xwalk x on x.block = s.block
    left join stamps st on st.filename = s.filename
), places as (
    select case when grouping(county) = 0 then 'county:' || county
                when grouping(town) = 0 then 'municipality:' || town
                when grouping(zcta) = 0 then 'zip:' || zcta
                else 'state:34' end as entity_id,
           sum(locations)::bigint as locations,
           sum(fiber)::bigint as fiber,
           sum(unserved_wired)::bigint as unserved_wired,
           sum(unserved_terrestrial)::bigint as unserved_terrestrial,
           -- Locations in blocks the crosswalk does not know; counted only above.
           sum(case when town is null then locations else 0 end)::bigint as unplaced,
           any_value(release_vintage) as release_vintage,
           any_value(file_sha256) as file_sha256
    from blocks
    group by grouping sets ((county), (town), (zcta), ())
)
select 'fcc_bdc_locations' as source_id,
       'broadband_place' as kind,
       entity_id,
       'locations' as record_id,
       json_object(
           'locations', locations,
           'fiber', fiber,
           'unserved_wired', unserved_wired,
           'unserved_terrestrial', unserved_terrestrial,
           'unplaced', unplaced,
           'as_of', split_part(release_vintage, '_', 1),
           'revision', split_part(release_vintage, '_', 2),
           'url', 'https://broadbandmap.fcc.gov/data-download/nationwide-data'
       )::varchar as payload,
       split_part(release_vintage, '_', 1)::date as snapshot,
       'served' as release_layer,
       release_vintage,
       file_sha256
from places
where entity_id not in ('municipality:', 'zip:')
  and entity_id is not null
