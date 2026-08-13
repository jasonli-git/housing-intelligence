{#
    The vintage of the release a staged row came from, read off the Parquet path.

    Landing writes every file to `data/parquet/<source_id>/<vintage>/<layer>.parquet`
    (`hip.landing.tabular.parquet_path`), so the second-to-last path segment *is* the
    vintage for every source, with no per-source knowledge.

    This exists because a fact could not previously name the file it came from.
    `_release_ids` keyed releases on `(source_id, layer)`, which is not unique for a
    source publishing several vintages: ACS has ten releases across five vintages and
    HUD has 107, so all but one collapsed and every year's value cited the survivor.
    Every ACS observation in the warehouse claimed vintage 2019 (ARCHITECTURE #47, #53).

    Requires the model to read its Parquet with `filename=true`.
#}
{% macro release_vintage(column='filename') %}
    regexp_extract({{ column }}, '/([^/]+)/[^/]+\.parquet$', 1)
{% endmacro %}
