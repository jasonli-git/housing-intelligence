/**
 * Flood and environmental exposure (Milestone 40, ARCHITECTURE #301-#304): the rules the
 * page's two sections read by, kept apart from the components so each is tested alone.
 *
 * - FEMA's zone shares exist only where its digital map covers 95% of homes; where they
 *   are missing, the page says why rather than showing nothing or a zero.
 * - Flood claims are complete, so a year with none paid is a zero; the newest year in
 *   the data is still filling and is reported "so far", never compared as a whole year.
 * - A town's claims are estimated from FEMA's block groups (#354). Where FEMA's codes
 *   leave too many unplaceable between a town and its neighbours, the page shows the
 *   county's instead and says why.
 * - Counts of contaminated sites and water violations are listed, never scored.
 */

import type { Observation, PacketLevel } from "@/lib/api";

/** Below this share of homes covered by FEMA's digital map, no zone share is published. */
export const MAPPED_FLOOR = 0.95;

export type FloodLevels = {
  high: number | null;
  moderate: number | null;
  homes: number | null;
  mapped: number | null;
  tidal: number | null;
};

export function floodLevels(levels: PacketLevel[]): FloodLevels {
  const value = (id: string) => levels.find((l) => l.metric_id === id)?.value ?? null;
  return {
    high: value("fema_flood_homes_share"),
    moderate: value("fema_flood_homes_share_moderate"),
    homes: value("fema_flood_homes"),
    mapped: value("fema_mapped_homes_share"),
    tidal: value("njdep_tidal_homes_share"),
  };
}

/** Why the zone shares are missing, when they are: the map does not cover the place. */
export function unmapped(levels: FloodLevels): boolean {
  return levels.high === null && levels.mapped !== null && levels.mapped < MAPPED_FLOOR;
}

export type ClaimYear = { year: number; claims: number; paid: number };

export type ClaimsSummary = {
  /** The newest year in the data, still filling. */
  partialYear: number;
  partial: ClaimYear;
  /** The ten whole years before it. */
  first: number;
  last: number;
  claims: number;
  paid: number;
  /** Every year since records begin, the worst three by claims. */
  since: number;
  worst: ClaimYear[];
  /** Claims over the same ten years that may be this town's but cannot be placed. */
  unplaced: number;
};

/**
 * At or above this share of a town's claims left unplaceable — over every year, against
 * the placed and unplaceable together — its own figure says too little to stand alone.
 */
export const UNPLACED_CEILING = 0.1;

const total = (observations: Observation[]) => observations.reduce((a, o) => a + o.value, 0);

/**
 * Whether a town's own claims can be shown, rather than its county's (#354): some were
 * placed in it, and the claims FEMA's codes cannot place between it and a neighbour are
 * under a tenth of what it might have.
 */
export function ownClaimsUsable(claims: Observation[], unplaced: Observation[]): boolean {
  const placed = total(claims);
  const maybe = total(unplaced);
  return placed > 0 && maybe / (placed + maybe) < UNPLACED_CEILING;
}

/** Whether a town has claims that might be its own and cannot be placed. */
export function hasUnplaced(unplaced: Observation[]): boolean {
  return total(unplaced) > 0;
}

/**
 * Claims and payments by year, zero-filled, summed over the last ten whole years.
 *
 * `newestYear` is the dataset's newest year, still filling. A town's or ZIP code's own
 * newest year with a claim can be years older, and taking it instead would call a whole
 * year "so far" and shift the window back; the county's newest year is the dataset's.
 */
export function claimsSummary(
  claims: Observation[],
  paid: Observation[],
  unplaced: Observation[] = [],
  newestYear: number | null = null,
): ClaimsSummary | null {
  if (claims.length === 0) return null;
  const years = new Map<number, ClaimYear>();
  const at = (year: number) => {
    const held = years.get(year) ?? { year, claims: 0, paid: 0 };
    years.set(year, held);
    return held;
  };
  for (const o of claims) at(Number(o.period_end.slice(0, 4))).claims += o.value;
  for (const o of paid) at(Number(o.period_end.slice(0, 4))).paid += o.value;
  const partialYear = Math.max(newestYear ?? 0, ...years.keys());
  const last = partialYear - 1;
  const first = last - 9;
  const window = [...years.values()].filter((y) => y.year >= first && y.year <= last);
  const whole = [...years.values()].filter((y) => y.year < partialYear);
  return {
    partialYear,
    partial: years.get(partialYear) ?? { year: partialYear, claims: 0, paid: 0 },
    first,
    last,
    claims: window.reduce((a, y) => a + y.claims, 0),
    paid: window.reduce((a, y) => a + y.paid, 0),
    since: Math.min(...years.keys()),
    worst: whole.sort((a, b) => b.claims - a.claims || b.year - a.year).slice(0, 3),
    unplaced: total(
      unplaced.filter((o) => {
        const y = Number(o.period_end.slice(0, 4));
        return y >= first && y <= last;
      }),
    ),
  };
}

/** A share of homes as the sentence says it: "under 1%" rather than "0.3%". */
export function shareText(share: number): string {
  if (share === 0) return "none";
  if (share < 0.01) return "under 1%";
  if (share > 0.99 && share < 1) return "over 99%";
  return `${Math.round(share * 100)}%`;
}

/** EPA's report for one water system, where its violations and the actions on them are. */
export function systemReportUrl(pwsid: string): string {
  return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(pwsid)}&sys=SDWIS`;
}
