/**
 * Line icons for the "Your next step" links (2026-10-10): one per kind of check, drawn
 * on a 24-unit grid in the link's own colour. Decorative: each link's text says what it
 * does, so every icon is hidden from assistive technology.
 */
const PATHS = {
  tax: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  school: "M3 9l9-5 9 5-9 5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5M21 9v6",
  flood: "M3 15c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M3 19c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M12 3l-4 6h8z",
  water: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  internet: "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  sites: "M12 3l9.5 17h-19zM12 10v4.5M12 17.5h.01",
  commute: "M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 11h16M8 21l1.5-4M16 21l-1.5-4M8 14h.01M16 14h.01",
  safety: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M9 12l2 2 4-4",
  budget: "M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 7l12-3v3M17 13.5h.01",
  guide: "M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 1 2 2zM7 8h2M15 8h2",
  listings: "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  voucher: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM10 7v10",
  authority: "M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8",
} as const;

export type StepIconName = keyof typeof PATHS;

export function StepIcon({ name }: { name: StepIconName }) {
  return <svg className="step-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={PATHS[name]} /></svg>;
}
