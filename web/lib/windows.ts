/**
 * The change windows the New Jersey page offers.
 *
 * In a plain module rather than the explorer's own: a value exported from a "use client"
 * file reaches a server component as a client reference, not as the array, so the page
 * that fetches rankings for each window could not iterate it.
 */

export type WindowKey = "5y" | "10y" | "since_2019";

export const WINDOWS: readonly { key: WindowKey; label: string; phrase: string }[] = [
  { key: "5y", label: "5 years", phrase: "over five years" },
  { key: "10y", label: "10 years", phrase: "over ten years" },
  { key: "since_2019", label: "Since 2019", phrase: "since 2019" },
];
