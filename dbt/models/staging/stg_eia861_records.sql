{{ config(materialized='table') }}
with files as (
    select *, {{ release_vintage() }} as release_vintage
    from read_parquet('{{ var("parquet_dir") }}/eia861/[0-9]*/utilities.parquet', filename=true)
)
select 'eia861' as source_id, 'electric_utility' as kind,
       'utility:' || utility_id as entity_id, utility_id as record_id,
       payload, make_date(release_vintage::int, 12, 31) as snapshot,
       'utilities' as release_layer, release_vintage
from files where release_vintage::int = (select max(release_vintage::int) from files)
