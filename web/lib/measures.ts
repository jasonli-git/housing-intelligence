/**
 * A measure as the New Jersey page's county comparison receives it: its ranked rows per
 * window. Moved out of the retired `CountyExplorer` map component (PR #98, ARCHITECTURE
 * #311) when the map was removed; the comparison table still reads it.
 */

import type { WindowKey } from "@/lib/windows";

export type RankRow = {
  id: number;
  name: string;
  rank: number;
  of: number;
  change: number;
  latest: number | null;
  /** The ranks the measure's margins of error leave it; null without margins (M28). */
  best?: number | null;
  worst?: number | null;
  /** The 90% margins of `change` and `latest`; null without margins (migration 0018). */
  changeMargin?: number | null;
  latestMargin?: number | null;
};

/** "3–18" where the margins leave a range, the rank itself where they do not. */

export type Measure = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  windows: Partial<
    Record<
      WindowKey,
      { start: string | null; end: string | null; rows: RankRow[] }
    >
  >;
};
