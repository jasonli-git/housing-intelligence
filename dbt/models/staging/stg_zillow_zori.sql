-- Zillow Observed Rent Index, long form, in-scope states only.
{{ config(materialized='table') }}

{{ zillow_observations('zillow_zori') }}
