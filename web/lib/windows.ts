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

type Span = { start: string | null; end: string | null };

// HUD's fiscal 2020 began on 1 October 2019. A Fair Market Rent window starting before
// it spans HUD's move from the 50th to the 40th percentile in parts of the state.
const FMR_METHOD_CHANGE = "2019-10-01";

/**
 * What a reader needs to read "Since 2019" (Milestone 17): why it starts there, and what
 * follows for the measure in view. Empty for the other windows, which say what they are.
 *
 * Whether it compares the same two readings as five years is read from the rankings'
 * own window dates rather than from a list of sources: annual survey figures start both
 * windows at their 2019 edition today, and the two part the day a newer edition loads —
 * which this notices without anyone editing it.
 */
export function windowNote(
  key: WindowKey,
  metricId: string,
  windows: Partial<Record<WindowKey, Span>>,
): string[] {
  if (key !== "since_2019") return [];
  const notes = [
    "“Since 2019” starts at the last full year before the pandemic, so it shows how much " +
      "has changed since before COVID. Unlike five or ten years, it does not move forward " +
      "as new figures arrive.",
  ];
  const since = windows.since_2019;
  const five = windows["5y"];
  if (since?.start && since.start === five?.start && since.end === five?.end) {
    notes.push(
      "For this measure it compares the same two readings as five years, because its " +
        "newest reading is five years after its 2019 one.",
    );
  }
  if (metricId.startsWith("hud_fmr") && since?.start && since.start < FMR_METHOD_CHANGE) {
    notes.push(
      "HUD moved some New Jersey areas from the 50th to the 40th percentile of rents by " +
        "fiscal 2020, so part of this change is HUD’s method rather than the market.",
    );
  }
  return notes;
}
