-- Zillow Home Value Index, long form, in-scope states only.
{{ config(materialized='table') }}

{{ zillow_observations('zillow_zhvi') }}
