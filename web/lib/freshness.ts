/**
 * The freshness page's wording and ordering (Milestone 27, `GET /freshness`).
 *
 * The page exists because *checked today* must never read as *measured today*: a source
 * asked yesterday can still describe last year. So every row keeps three dates apart —
 * the newest period its figures describe, when the site last asked the publisher, and
 * when the data was downloaded — and no date is invented where the source gave none.
 *
 * Dates are labels, sliced from ISO strings rather than parsed into a `Date`, the same
 * rule `lib/periods.ts` keeps: a UTC timestamp formatted in a reader's timezone moves a
 * day for half the world. Only `checkedDaysBefore` does arithmetic, and it does it on
 * UTC calendar days read out of the strings.
 */

import type { FreshnessStatus, SourceFreshness } from "@/lib/api";
import { monthLabel } from "@/lib/periods";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Plain wording for each status: a short label, and what it means for a reader. */
export const STATUS_COPY: Record<FreshnessStatus, { label: string; means: string }> = {
  current: {
    label: "Current",
    means: "When this page was built, the last check had found nothing newer released.",
  },
  pending: {
    label: "Newer release waiting",
    means:
      "When this page was built, the publisher had released a newer edition that had not " +
      "taken effect yet. The site keeps showing the edition in force until it does.",
  },
  unreachable: {
    label: "Could not reach",
    means:
      "When this page was built, the last check could not reach the publisher, so these " +
      "are the figures from the last time it could.",
  },
  not_tracked: {
    label: "No release schedule",
    means:
      "This source publishes to one fixed address and is re-read whenever that file " +
      "changes, or is held at a chosen edition on purpose. Either way there is no dated " +
      "release to watch for, and this page does not yet record when it was last read.",
  },
};

// Problems first, so a reader scanning for trouble finds it at the top.
const ORDER: Record<FreshnessStatus, number> = {
  unreachable: 0,
  pending: 1,
  current: 2,
  not_tracked: 3,
};

/** Sources in the order the page shows them: by status, then by name. */
export function sortForDisplay(sources: SourceFreshness[]): SourceFreshness[] {
  return [...sources].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
}

/** "Sep 26, 2026" from "2026-09-26" or "2026-09-26T00:51:05Z"; "—" for nothing. */
export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const month = Number(iso.slice(5, 7));
  return `${MONTHS[month - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

/** The newest period a source's figures describe, at month precision: "Jul 2026". */
export function throughLabel(periodEnd: string | null): string {
  return periodEnd ? monthLabel(periodEnd) : "—";
}

/**
 * Whether a source's newest period ends after the page was built. Figures set in advance —
 * a Fair Market Rent year (Oct–Sep), an income-limit year — describe a period still under
 * way, and "through Sep 2026" printed on Sep 26 without saying so reads as measured to a
 * date not yet reached. Compared as ISO day strings, like everything else here.
 */
export function stillUnderWay(generatedAt: string, periodEnd: string | null): boolean {
  return periodEnd !== null && periodEnd.slice(0, 10) > generatedAt.slice(0, 10);
}

/** What comes next, only where the publisher itself has said: "2027, from Oct 1, 2026". */
export function nextLabel(source: SourceFreshness): string {
  if (!source.pending) return "—";
  return source.pending_from
    ? `${source.pending}, from ${dayLabel(source.pending_from)}`
    : source.pending;
}

function utcDay(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** Whole UTC days between when a source was last asked and when this page was built. */
export function checkedDaysBefore(generatedAt: string, checkedAt: string | null): number | null {
  if (!checkedAt) return null;
  return Math.round((utcDay(generatedAt) - utcDay(checkedAt)) / 86_400_000);
}

// A week's refresh plus a day's grace: past this, "last checked" is old enough that a
// reader should be told rather than left to do the subtraction.
export const STALE_CHECK_DAYS = 8;

/**
 * How long ago a page was built, beside its build date: "today", "3 days ago". The page
 * is a snapshot, rebuilt when a figure or a source's status changes, so a quiet stretch
 * leaves it as it was, and its age is what tells a reader how far "Current" reaches
 * (ARCHITECTURE #233). Counted in UTC days, like every other date here.
 */
export function builtAgo(generatedAt: string, now: Date): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.round((today - utcDay(generatedAt)) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
