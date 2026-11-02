import styles from "./poster.module.css";

import type { PlaceStorySummary } from "@/lib/placeStories";

/** A story's own rows as bars: shares on a 0–100% scale, counts against the largest. */
export function StoryBars({ rows }: { rows: PlaceStorySummary["rows"] }) {
  const percent = rows.every((row) => row.formatted.endsWith("%"));
  const peak = Math.max(...rows.map((row) => row.value), 1);
  return <>{rows.map((row) => <div key={row.label} className={styles.storyBar}>
    <span>{row.label}</span>
    <div><i style={{ width: `${percent ? parseFloat(row.formatted) : (row.value / peak) * 100}%` }} /></div>
    <strong>{row.formatted}</strong>
  </div>)}</>;
}
