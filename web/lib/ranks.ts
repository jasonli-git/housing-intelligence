/**
 * A rank in words: what it ranks, among whom, and which end is first (Milestone 17).
 *
 * Every rank on the site is one of two numbers — where a region's change over a window
 * falls among its peers, or where its latest value does — and both used to print as a
 * bare "9 / 21". Beside a price, a reader takes that for a price rank: Mercer's home value
 * was "$450,985, rank 9 of 21", which reads as the ninth most expensive county when it is
 * the ninth largest rise and the fourteenth by price. So every rank names its basis where
 * it is shown, and says which end is 1. The order itself is `hip/analytics/compute.py`'s:
 * the better end where a measure defines one, otherwise the largest first.
 */

export type RankBasis = "change" | "value";

/** Rank 1 at zero, the final rank at one; a cohort of one sits in the middle. */
export function rankPosition(rank: number, of: number): number {
  return of > 1 ? (rank - 1) / (of - 1) : 0.5;
}

/** The column heading over each kind of rank. */
export const RANK_HEADING: Record<RankBasis, string> = {
  change: "Rank by change",
  value: "Rank by value",
};

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd … 111th. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * Which end rank 1 is. A lower-is-better measure — unemployment, a cost ratio — ranks
 * its smallest rise or lowest value first; every other measure its largest.
 */
export function firstEnd(basis: RankBasis, direction: string): string {
  const lowFirst = direction === "lower_is_better";
  if (basis === "change") return lowFirst ? "smallest rise first" : "largest rise first";
  return lowFirst ? "lowest first" : "highest first";
}

/**
 * A rank as a sentence fragment: "9th of 21 by change over five years, largest rise
 * first", or "14th of 21 by value, highest first". `span` names a change's window.
 */
export function rankWords(
  rank: number,
  of: number,
  basis: RankBasis,
  direction: string,
  span = "over five years",
): string {
  const by = basis === "change" ? `by change ${span}` : "by value";
  return `${ordinal(rank)} of ${of} ${by}, ${firstEnd(basis, direction)}`;
}
