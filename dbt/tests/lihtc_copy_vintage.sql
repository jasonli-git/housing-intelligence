-- Declared release coverage is not the greatest year in a service-year cell.
select record_id
from {{ ref('stg_hud_lihtc_records') }}
where snapshot <> make_date(release_vintage::int, 12, 31)
   or json_extract(payload, '$.coverage_through')::int <> release_vintage::int
   or (json_extract(payload, '$.placed_in_service')::int > release_vintage::int
       and json_extract_string(payload, '$.service_year_status') <> 'after coverage year')
   or release_vintage::int <> (
       select max(release_vintage::int) from {{ ref('stg_hud_lihtc_records') }}
   )
