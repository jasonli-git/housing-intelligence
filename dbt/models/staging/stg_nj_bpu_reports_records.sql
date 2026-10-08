{{ config(materialized='table') }}
-- Each utility's annual report to BPU, one file per utility and year (ARCHITECTURE #347).
{% set reports = [('ace','2024'),('ace','2025'),('jcpl','2024'),('jcpl','2025'),
                  ('pseg','2024'),('pseg','2025'),('reco','2024'),('reco','2025')] %}
{% for layer, vintage in reports %}
select 'nj_bpu_reports' as source_id, 'regulatory_reliability' as kind,
       'utility:' || utility_id as entity_id, record_id, payload,
       make_date(year::int, 12, 31) as snapshot,
       '{{ layer }}' as release_layer, '{{ vintage }}' as release_vintage
from read_parquet('{{ var("parquet_dir") }}/nj_bpu_reports/{{ vintage }}/{{ layer }}.parquet')
{% if not loop.last %}union all{% endif %}
{% endfor %}
