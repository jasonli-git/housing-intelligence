/**
 * Where a household's income sits against HUD's income limits (Milestone 35), and what of
 * the reader's own household follows them from page to page.
 *
 * Positions, never eligibility: HUD's lines are the start of most housing programs'
 * rules, not the whole of any of them, so the sentence says where an income sits and
 * never that a household qualifies (ARCHITECTURE #285). Named plainly first — "80% of
 * the area's median income" — and then as HUD names it, decided with the owner
 * 2026-10-01.
 *
 * HUD's lines are not exactly 30%, 50% and 80% of the median: it adjusts them for high
 * housing costs, for the federal poverty line and by household size. So the sentence
 * quotes the line's dollar figure beside its percentage, and the percentage is HUD's name
 * for the band rather than arithmetic on the median.
 */

export type IncomeBand = { band: number; hud_name: string; limits: number[] };

export type IncomeLimits = {
  region_id: number;
  county_id: number;
  county_name: string;
  /** How the county was reached: the region itself, its parent, or a ZIP's crosswalk. */
  via: "self" | "parent" | "crosswalk";
  fiscal_year: number;
  median_income: number | null;
  bands: IncomeBand[];
  source: string;
};

export const SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type Position = {
  /** The highest of HUD's lines the income is at or below, or null when above all three. */
  within: IncomeBand | null;
  /** The next line down, which the income is above, or null when below the lowest. */
  above: IncomeBand | null;
  /** Each band's line for this household size, lowest first. */
  lines: { band: IncomeBand; limit: number }[];
};

/** HUD's line for one band and household size. */
export function lineFor(band: IncomeBand, size: number): number {
  return band.limits[Math.min(Math.max(size, 1), band.limits.length) - 1];
}

/**
 * Where `income` sits for a household of `size`. HUD's lines are ceilings — a household
 * "does not exceed" one — so an income exactly on a line is within it.
 */
export function positionOf(limits: IncomeLimits, size: number, income: number): Position {
  const lines = [...limits.bands]
    .sort((a, b) => a.band - b.band)
    .map((band) => ({ band, limit: lineFor(band, size) }));
  const atOrBelow = lines.find((line) => income <= line.limit) ?? null;
  const index = atOrBelow ? lines.indexOf(atOrBelow) : lines.length;
  return {
    within: atOrBelow?.band ?? null,
    above: index > 0 ? lines[index - 1].band : null,
    lines,
  };
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function household(size: number): string {
  return size === 1 ? "a household of one" : `a household of ${size}`;
}

/** The county as HUD names its area here: "Hudson County". */
export function countyLabel(limits: IncomeLimits): string {
  return limits.county_name.endsWith("County")
    ? limits.county_name
    : `${limits.county_name} County`;
}

/**
 * The sentence: "$68,000 for a household of 3 is at or below Hudson County's 80% line
 * ($106,150) — 80% of the area's median income, what HUD calls “low income” — and above
 * its 50% line ($66,300)." The dollar figure is the line, never the median it is a share
 * of, and sits beside the line's name so it cannot be read as the median.
 */
export function positionSentence(limits: IncomeLimits, size: number, income: number): string {
  const { within, above, lines } = positionOf(limits, size, income);
  const place = countyLabel(limits);
  const lead = `${money(income)} for ${household(size)}`;
  if (within === null) {
    const top = lines[lines.length - 1];
    return (
      `${lead} is above all three of HUD’s lines for ${place}, the highest being its ` +
      `${top.band.band}% line (${money(top.limit)}), ${top.band.band}% of the area’s median ` +
      `income.`
    );
  }
  const limit = lineFor(within, size);
  const head =
    `${lead} is at or below ${place}’s ${within.band}% line (${money(limit)}) — ` +
    `${within.band}% of the area’s median income, what HUD calls “${within.hud_name}”`;
  if (above === null) return `${head} — the lowest of its three lines.`;
  return `${head} — and above its ${above.band}% line (${money(lineFor(above, size))}).`;
}

// What of the reader's household is remembered, in their browser alone: the household
// size and income they typed, and the rent they pay now. All three describe the reader,
// not a home, so they follow the reader across pages — the rule Milestone 33 set
// (`costScenario.ts`). Guarded like it: storage can be absent or refuse.
export type Household = { size?: number; income?: number; rent?: number; cash?: number };

const STORE = "hip.household.v1";
export const HOUSEHOLD_EVENT = "hip:household-change";

export function readHousehold(): Household {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const kept: Household = {};
    const record = parsed as Record<string, unknown>;
    const size = record.size;
    if (typeof size === "number" && Number.isInteger(size) && size >= 1 && size <= 8) {
      kept.size = size;
    }
    for (const key of ["income", "rent", "cash"] as const) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) kept[key] = value;
    }
    return kept;
  } catch {
    return {};
  }
}

export function writeHousehold(household: Household): void {
  try {
    if (Object.keys(household).length === 0) window.localStorage.removeItem(STORE);
    else window.localStorage.setItem(STORE, JSON.stringify(household));
  } catch {
    // A private window or blocked storage: the household holds for this page only.
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(HOUSEHOLD_EVENT, { detail: household }));
  }
}
