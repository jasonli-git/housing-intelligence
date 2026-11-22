-- FEMA's flood zones and NJDEP's tidal area, repaired and cut into pieces small enough
-- to lay over blocks (Milestone 40, ARCHITECTURE #301).
--
-- Two things made the plain overlay unworkable. 1,120 of NJDEP's tidal polygons are
-- invalid (self-touching rings), and an intersection with one ends the model, so every
-- polygon is made valid first. And the largest are vast: one tidal polygon has 243,428
-- vertices and one of FEMA's minimal-hazard polygons 187,829, so every block touching
-- one cut it whole. Here each polygon over 2,000 vertices is halved across its longer
-- side, again and again, until every piece is under; area is kept exactly, and the
-- work is n log n once rather than n for every block. Measured on the tidal layer: 38s
-- to cut, 7s to overlay, where the uncut overlay had not finished in ten minutes.
{{ config(materialized='table') }}

with recursive polygons as (
    -- Each piece keeps its state, so a block is laid over its own state's map only:
    -- two states' maps meet along a river and may overlap (Milestone 63).
    select left(DFIRM_ID, 2) as state,
           case
               when SFHA_TF = 'T' then 'high'
               when FLD_ZONE = 'X' and (ZONE_SUBTY like '0.2 PCT%'
                                        or ZONE_SUBTY like '%LEVEE%') then 'moderate'
               when FLD_ZONE = 'D' then 'undetermined'
               else 'minimal'
           end as class,
           ST_MakeValid(ST_GeomFromGeoJSON(geometry)) as geom
    from read_parquet('{{ var("parquet_dir") }}/fema_nfhl/current/zones*.parquet')
    where geometry is not null
    union all
    select '34', 'tidal', ST_MakeValid(ST_GeomFromGeoJSON(geometry))
    from read_parquet('{{ var("parquet_dir") }}/njdep_cafe/current/tidal.parquet')
    where geometry is not null
),
parts(state, class, geom, depth) as (
    select state, class, geom, 0 from polygons
    union all
    select p.state, p.class, ST_Intersection(p.geom, h.half), p.depth + 1
    from parts p,
         lateral (
             select ST_XMin(p.geom) as x0, ST_YMin(p.geom) as y0,
                    ST_XMax(p.geom) as x1, ST_YMax(p.geom) as y1
         ) e,
         lateral (
             select unnest(
                 case when e.x1 - e.x0 >= e.y1 - e.y0 then [
                     ST_MakeEnvelope(e.x0, e.y0, (e.x0 + e.x1) / 2, e.y1),
                     ST_MakeEnvelope((e.x0 + e.x1) / 2, e.y0, e.x1, e.y1)
                 ] else [
                     ST_MakeEnvelope(e.x0, e.y0, e.x1, (e.y0 + e.y1) / 2),
                     ST_MakeEnvelope(e.x0, (e.y0 + e.y1) / 2, e.x1, e.y1)
                 ] end
             ) as half
         ) h
    where ST_NPoints(p.geom) > 2000 and p.depth < 30
)
select state, class, geom
from parts
where (ST_NPoints(geom) <= 2000 or depth = 30) and not ST_IsEmpty(geom)
