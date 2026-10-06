-- New Jersey residents' jobs, placed at home and at work (Milestone 45, ARCHITECTURE
-- #313): LODES's newest year, all jobs (JT00), from New Jersey's main file and the rows
-- of every other state's auxiliary file whose home block is in New Jersey.
--
-- New Jersey's blocks are placed by LODES's own crosswalk (county subdivision, county,
-- ZCTA), so no spatial join is needed; a workplace elsewhere is placed by its block's
-- state and county digits. One row per home block and workplace block.
{{ config(materialized='table') }}

with main as (
    select h_geocode, w_geocode, S000::integer as jobs,
           regexp_extract(filename, '/census_lodes/(\d{4})/', 1)::integer as year
    from read_parquet('{{ var("parquet_dir") }}/census_lodes/*/od_main.parquet',
                      filename = true)
),
aux as (
    select h_geocode, w_geocode, S000::integer as jobs,
           regexp_extract(filename, '/census_lodes/(\d{4})/', 1)::integer as year
    from read_parquet('{{ var("parquet_dir") }}/census_lodes/*/od_aux_*.parquet',
                      filename = true)
    where left(h_geocode, 2) = '34'
),
newest as (select max(year) as year from main),
xwalk as (
    select tabblk2020 as block, cty as county, ctycsub as town, zcta,
           regexp_extract(filename, '/census_lodes/(\d{4})/', 1)::integer as year
    from read_parquet('{{ var("parquet_dir") }}/census_lodes/*/xwalk.parquet',
                      filename = true)
),
jobs as (
    select j.* from (select * from main union all select * from aux) j
    join newest using (year)
)
select j.year,
       h.town as home_town,
       h.county as home_county,
       -- LODES gives a block outside every ZCTA as 99999.
       nullif(h.zcta, '99999') as home_zcta,
       left(j.w_geocode, 2) as work_state,
       left(j.w_geocode, 5) as work_county,
       w.town as work_town,
       j.jobs
from jobs j
join xwalk h on h.block = j.h_geocode and h.year = j.year
left join xwalk w on w.block = j.w_geocode and w.year = j.year
