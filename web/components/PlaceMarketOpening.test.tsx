// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PacketLevel, PacketMetric } from "@/lib/api";
import { PlaceMarketOpening } from "./PlaceMarketOpening";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const level = (metric_id: string, value: number, extra: Partial<PacketLevel> = {}): PacketLevel => ({
  metric_id, value, label: metric_id, unit: "usd", direction: "neutral", period_start: "2026-09-01",
  period_end: "2026-09-30", rank: 2, of: 12, percentile: null, release_id: null, source_id: null, match_method: null, ...extra,
});
const props = {
  levels: [level("zhvi_sfr", 500000), level("zori_all", 2400, { unit: "usd_month" })],
  metrics: [] as PacketMetric[], uncertainties: { value: new Map(), change: new Map() },
  peers: { count: 20, noun: "municipalities", scope: "New Jersey" }, headline: "A computed market summary.",
  guideHref: "/guide?place=224", reportHref: "/nj/princeton/report",
};

it("keeps prices, rents, dates, interpretation limits and statewide cohorts visible without disclosures", () => {
  const { container } = render(createElement(PlaceMarketOpening, props));
  expect(screen.getByText("$500,000")).toBeTruthy();
  expect(container.textContent).toContain("$2,400");
  expect(container.textContent).toContain("Zillow · Sep 2026");
  expect(container.textContent).toContain("2nd of 12 NJ municipalities with data");
  expect(container.textContent).toContain("not a nearby-place comparison");
  expect(container.textContent).toContain("not a sale price or an appraisal");
  expect(container.textContent).toContain("not what every existing tenant pays");
  expect(container.querySelector("details")).toBeNull();
  expect(screen.getByRole("link", { name: /Figures & sources/ }).getAttribute("href")).toBe("/nj/princeton/report#report-measures");
  expect(screen.getByRole("link", { name: /cost per month/ }).getAttribute("href")).toBe("#quiet-cost");
});

it("shows only an existing change whose end matches the displayed figure", () => {
  const change = { metric_id: "zhvi_sfr", pct_change: 25, window_start: "2021-09-30", window_end: "2026-09-30" } as PacketMetric;
  const { container, rerender } = render(createElement(PlaceMarketOpening, { ...props, metrics: [change] }));
  expect(container.textContent).toContain("+25.0% over five years");
  expect(container.textContent).toContain("Sep 2021 → Sep 2026");
  rerender(createElement(PlaceMarketOpening, { ...props, metrics: [{ ...change, window_end: "2026-08-31" }] }));
  expect(container.textContent).not.toContain("+25.0%");
});

it("does not substitute old survey rents or values for a missing market index", () => {
  const { container } = render(createElement(PlaceMarketOpening, { ...props, levels: [level("acs_median_gross_rent", 900), level("acs_median_home_value", 100000)] }));
  expect(container.textContent).toContain("No current market-rent index");
  expect(container.textContent).toContain("No current home-value index");
  expect(container.textContent).not.toContain("$900");
  expect(container.textContent).not.toContain("$100,000");
});

it("keeps survey period and uncertainty visible for the housing mix", () => {
  const row = level("acs_homeownership_rate", .6, { unit: "ratio", period_start: "2020-01-01", period_end: "2024-12-31" });
  const { container } = render(createElement(PlaceMarketOpening, { ...props, levels: [...props.levels, row], uncertainties: { value: new Map([[row.metric_id, { margin: .03, best: 2, worst: 5 }]]), change: new Map() } }));
  expect(container.textContent).toContain("60.0% of occupied homes");
  expect(container.textContent).toContain("2020–2024");
  expect(container.textContent).toContain("± 3.0 points");
});

it("retains revision markers on promoted price/rent figures", () => {
  render(createElement(PlaceMarketOpening, { ...props, revisions: new Map([["zhvi_sfr", { from: "$490,000", on: "2026-10-20" }]]) }));
  expect(screen.getByRole("link", { name: /Updated/ }).getAttribute("href")).toBe("/changes");
  expect(screen.getByText(/first published as \$490,000/)).toBeTruthy();
});

it("labels recent recorded sales as transactions and displays their full window", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27"));
  const { container } = render(createElement(PlaceMarketOpening, { ...props, levels: [level("sr1a_median_sale_price", 450000, { period_start: "2024-01-01", period_end: "2026-06-30" })] }));
  expect(screen.getByRole("heading", { name: "Median recorded sale price" })).toBeTruthy();
  expect(container.textContent).toContain("Jan 2024 → Jun 2026");
  expect(container.textContent).toContain("not the value of every home");
  expect(container.textContent).not.toContain("modeled value");
});

it("does not revive a stale sales median as a current home value", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27"));
  const { container } = render(createElement(PlaceMarketOpening, { ...props, levels: [level("sr1a_median_sale_price", 450000, { period_end: "2020-12-31" })] }));
  expect(container.textContent).toContain("No current home-value index");
  expect(container.textContent).not.toContain("$450,000");
});
