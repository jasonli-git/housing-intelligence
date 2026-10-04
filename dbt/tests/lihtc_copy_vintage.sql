-- This fallback is labelled historical through 2020. If HUD updates the public
-- service, stop and review its coverage before publishing under the old label.
select record_id
from {{ ref('stg_hud_lihtc_records') }}
where json_extract(payload, '$.placed_in_service')::integer > 2020
