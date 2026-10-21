-- Original PostgreSQL pairwise implementation (#239/#247), retained as an oracle.
WITH margins AS (
    SELECT rr.metric_id, rr.level, rr.basis, rr."window", rr.region_id, rr."of",
           CASE WHEN m.direction = 'lower_is_better'
                THEN rr.value ELSE -rr.value END AS k,
           rr.margin_of_error AS margin
    FROM region_rankings rr JOIN metrics m ON m.metric_id = rr.metric_id
),
margined AS (
    SELECT metric_id, level, basis, "window" FROM margins
    GROUP BY 1, 2, 3, 4 HAVING count(margin) > 0
),
counts AS (
    SELECT a.metric_id, a.level, a.basis, a."window", a.region_id, a."of",
           count(*) FILTER (
               WHERE a.k - b.k > sqrt(a.margin ^ 2 + b.margin ^ 2)
           ) AS better,
           count(*) FILTER (
               WHERE b.k - a.k > sqrt(a.margin ^ 2 + b.margin ^ 2)
           ) AS worse
    FROM margins a
    JOIN margined g USING (metric_id, level, basis, "window")
    JOIN margins b
      ON b.metric_id = a.metric_id AND b.level = a.level
     AND b.basis = a.basis AND b."window" = a."window"
     AND b.region_id <> a.region_id
    GROUP BY 1, 2, 3, 4, 5, 6
)
UPDATE region_rankings rr
SET rank_best = 1 + c.better, rank_worst = c."of" - c.worse
FROM counts c
WHERE rr.metric_id = c.metric_id AND rr.level = c.level
  AND rr.basis = c.basis AND rr."window" = c."window"
  AND rr.region_id = c.region_id
