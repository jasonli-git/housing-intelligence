-- Where each county's movers came from and went to (Milestone 50, ARCHITECTURE #333):
-- the ten counties sending the most returns in, and the ten receiving the most out, in
-- the newest year pair.
--
-- Only county-to-county rows: the IRS's summaries (state codes 96–98) and its "Other
-- flows" remainders (57–59) are aggregates, not places, and the row naming the county
-- itself is those who stayed. The IRS publishes a county pair only when it holds 20
-- returns or more, so a short list means the rest were too small to show.
{{ config(materialized='table') }}

with pairs as (
    select 'in' as direction,
           lpad(y2_statefips::varchar, 2, '0') || lpad(y2_countyfips::varchar, 3, '0') as geoid,
           lpad(y1_statefips::varchar, 2, '0') || lpad(y1_countyfips::varchar, 3, '0') as other,
           y1_countyname as other_name, y1_state as other_state,
           regexp_extract(filename, '/(\d{4})/', 1) as pair, n1, n2, agi
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/inflow.parquet', filename=true)
    union all
    select 'out',
           lpad(y1_statefips::varchar, 2, '0') || lpad(y1_countyfips::varchar, 3, '0'),
           lpad(y2_statefips::varchar, 2, '0') || lpad(y2_countyfips::varchar, 3, '0'),
           y2_countyname, y2_state,
           regexp_extract(filename, '/(\d{4})/', 1), n1, n2, agi
    from read_parquet('{{ var("parquet_dir") }}/irs_migration/*/outflow.parquet', filename=true)
),
newest as (
    select max(pair) as pair from pairs
),
totals as (
    -- Every return that moved in or out, the share's denominator.
    select direction, geoid, n1 as total_returns
    from pairs, newest
    where pairs.pair = newest.pair and other = '96000'
),
places as (
    select p.*
    from pairs p, newest
    where p.pair = newest.pair
      and substr(p.geoid, 1, 2) in ({{ var("state_fips") }})
      and p.other <> p.geoid
      and substr(p.other, 1, 2)::int <= 56
      and p.n1 > 0
),
ranked as (
    select p.*, t.total_returns,
           row_number() over (
               partition by p.direction, p.geoid order by p.n1 desc, p.other
           ) as rank
    from places p
    join totals t using (direction, geoid)
)
select
    geoid,
    direction,
    rank,
    other as other_geoid,
    -- "New York County" with its state, which the IRS gives as a postal code.
    other_name || ', ' || other_state as other_name,
    n1 as returns,
    n2 as people,
    case when n1 > 0 then agi * 1000.0 / n1 end as agi_per_return,
    n1::double / total_returns as share,
    total_returns,
    2000 + substr(pair, 3, 2)::int as year,
    case direction when 'in' then 'inflow' else 'outflow' end as release_layer,
    pair as release_vintage
from ranked
where rank <= 10
