-- Transit stops near New Jersey, by the kind of service that stops there (Milestone 45,
-- ARCHITECTURE #314), from the National Transit Map.
--
-- Rail is commuter rail, PATH and PATCO, the subway, and light rail; bus includes the
-- few trolleybus stops. A stop with both is both. Ferry landings are left out: a ferry
-- is not the everyday trip a half-mile walk stands for. A stop's place is projected to
-- New Jersey State Plane (EPSG:3424, US survey feet), so distances are in feet.
{{ config(materialized='table') }}

with stops as (
    select stop_id, ntd_id, stop_type_text, download_date,
           stop_type_text ilike '%rail%' or stop_type_text ilike '%subway%' as is_rail,
           stop_type_text ilike '%bus%' as is_bus,
           ST_Transform(ST_Point(stop_lon::double, stop_lat::double),
                        'EPSG:4269', 'EPSG:3424', always_xy := true) as point
    from read_parquet('{{ var("parquet_dir") }}/bts_ntm/current/stops.parquet')
    -- GTFS location types 2 to 4 are entrances, generic nodes and boarding areas, not
    -- places a trip stops; the layer writes an absent type as '' or 'Null'.
    where coalesce(location_type, '') in ('', 'Null', '0', '1')
      and stop_lat is not null and stop_lon is not null
)
select * from stops where is_rail or is_bus
