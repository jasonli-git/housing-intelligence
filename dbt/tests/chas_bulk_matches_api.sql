-- HUD's bulk CHAS counts for a release must equal the API's for every geography both
-- carry (#353). A margin from a file whose counts differ would qualify a figure it was
-- not computed for; stg_hud_chas already withholds it, and this makes the miss loud.
select geoid, metric_id, release_vintage
from {{ ref('stg_hud_chas') }}
where bulk_present and not bulk_matches
