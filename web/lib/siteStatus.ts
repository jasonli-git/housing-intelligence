/**
 * The status link's words from the weekly check's `status.json` (ARCHITECTURE #411).
 * Pure, so the overdue rule and each wording are testable without a network.
 */
export type CheckStatus = { checked_at: string; outcome: "current" | "unreachable" | string };

/** A weekly check more than this many days old is late, and the link says so. */
export const OVERDUE_DAYS = 9;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function statusWords(
  status: CheckStatus | null,
  now: Date,
): { kicker: string; word: string; when: string; overdue: boolean } {
  const checked = status ? new Date(status.checked_at) : null;
  if (!checked || Number.isNaN(checked.getTime())) {
    return { kicker: "Source checks", word: "scheduled", when: "Fridays", overdue: false };
  }
  const day = `${MONTHS[checked.getUTCMonth()]} ${checked.getUTCDate()}`;
  const overdue = now.getTime() - checked.getTime() > OVERDUE_DAYS * 86_400_000;
  // `word` is the part phones hide (site-chrome.css), so what must always show — that a
  // check happened, or is late — sits in `kicker`.
  if (overdue) return { kicker: "Source check overdue", word: "", when: `· last ${day}`, overdue: true };
  return {
    kicker: "Sources checked",
    word: "",
    when: status?.outcome === "unreachable" ? `${day} · some unreachable` : day,
    overdue: false,
  };
}
