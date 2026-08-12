-- HUD USPS crosswalk: residential-address weights for allocating ZIP data.
--
-- `res_ratio` is the share of a ZIP's residential addresses falling in each target
-- geography. That is the correct basis for housing measures — area weighting counts a
-- golf course the same as a subdivision.
{{ config(materialized='table') }}

with raw as (
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud/current/zip_county_*.parquet', union_by_name=true
    )
    union all by name
    select * from read_parquet(
        '{{ var("parquet_dir") }}/hud/current/zip_countysub_*.parquet',
        union_by_name=true
    )
)
select
    from_geoid,
    'zip' as from_level,
    to_geoid,
    case when crosswalk_type = 'zip-county' then 'county' else 'municipality' end
        as to_level,
    -- HUD's ratios already sum to 1 per (zip, type), but renormalizing over the rows
    -- we keep makes the invariant hold even when a target is out of scope.
    res_ratio::double as raw_weight,
    'hud_res_ratio' as method
from raw
where res_ratio > 0
