-- ZHVI's bottom tier, long form, in-scope states only: counties and cities, since
-- Zillow publishes no ZIP file for its tiers (ARCHITECTURE #424).
{{ config(materialized='table') }}

{{ zillow_observations('zillow_zhvi_bottom', zip=false) }}
