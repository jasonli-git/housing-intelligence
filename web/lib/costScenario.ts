/**
 * The reader's own inputs to the cost of owning (Milestone 33), and which of them follow
 * the reader from one place to the next.
 *
 * Decided with the owner on 2026-10-01: what describes the reader — their down payment,
 * the rate they were quoted, their insurance quote, their assumptions about the years
 * ahead — is remembered in this browser and carried to every page. What describes a home —
 * its price, its tax bill, its HOA fees, its flood premium, the cost of moving into it —
 * belongs to the page it was typed on and is never carried. Only what the reader changed
 * is stored, so a published figure that updates is never pinned by an old visit.
 *
 * Kept in `localStorage`, which can be empty or refuse to answer (a private window,
 * cleared data); every read and write is guarded, and the page reads correctly without
 * it. Nothing typed here changes a published figure or a ranking: it is this reader's
 * scenario only.
 */

export type Personal = {
  downPct?: number;
  ratePct?: number;
  insuranceYear?: number;
  pmiPct?: number;
  upkeepPct?: number;
  closingPct?: number;
  years?: number;
  appreciationPct?: number;
  rentGrowthPct?: number;
  commissionPct?: number;
};

export const PERSONAL_KEYS: ReadonlyArray<keyof Personal> = [
  "downPct",
  "ratePct",
  "insuranceYear",
  "pmiPct",
  "upkeepPct",
  "closingPct",
  "years",
  "appreciationPct",
  "rentGrowthPct",
  "commissionPct",
];

const STORE = "hip.cost.personal.v1";
export const PERSONAL_EVENT = "hip:personal-change";

/** What a reader stored, keeping only known keys holding finite numbers. */
export function readPersonal(): Personal {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const kept: Personal = {};
    for (const key of PERSONAL_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) kept[key] = value;
    }
    return kept;
  } catch {
    return {};
  }
}

export function writePersonal(personal: Personal): void {
  try {
    if (Object.keys(personal).length === 0) window.localStorage.removeItem(STORE);
    else window.localStorage.setItem(STORE, JSON.stringify(personal));
  } catch {
    // A private window or blocked storage: the scenario holds for this page only.
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(PERSONAL_EVENT, { detail: personal }));
  }
}

/** A number typed into a field, or null for an empty or unreadable one. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s%]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
