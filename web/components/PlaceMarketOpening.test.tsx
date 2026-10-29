// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Observation, PacketLevel, PacketMetric } from "@/lib/api";
import { PlaceMarketOpening } from "./PlaceMarketOpening";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const level = (metric_id: string, value: number, extra: Partial<PacketLevel> = {}): PacketLevel => ({
  metric_id, value, label: metric_id, unit: "usd", direction: "neutral", period_start: "2026-09-01",
  period_end: "2026-09-30", rank: 2, of: 12, percentile: null, release_id: null, source_id: null, match_method: null, ...extra,
});
const props = {
  levels: [level("zhvi_sfr", 500000), level("zori_all", 2400, { unit: "usd_month" })],
  metrics: [] as PacketMetric[], uncertainties: { value: new Map(), change: new Map() },
  peers: { count: 20, noun: "municipalities", scope: "New Jersey" }, ownId: 224,
  cohorts: [
    { metricId: "zhvi_sfr", period: "2026-09-01", total: 20, points: [{ id: 1, name: "Lower Town", value: 300000 }, { id: 224, name: "Princeton", value: 500000 }, { id: 2, name: "Upper Town", value: 900000 }] },
    { metricId: "zori_all", period: "2026-09-01", total: 20, points: [{ id: 1, name: "Lower Town", value: 1800 }, { id: 224, name: "Princeton", value: 2400 }] },
  ],
  histories: [] as { metricId: string; observations: Observation[] }[],
  reportHref: "/nj/princeton/report",
};

it("keeps prices, rents, dates, interpretation limits and statewide cohorts visible without disclosures", () => {
  const { container } = render(createElement(PlaceMarketOpening, props));
  expect(screen.getAllByText("$500,000").length).toBeGreaterThan(0);
  expect(container.textContent).toContain("$2,400");
  expect(container.textContent).toContain("Zillow · Sep 2026");
  expect(container.textContent).toContain("3 of 20 NJ towns");
  expect(container.textContent).toContain("not just nearby towns");
  expect(container.textContent).toContain("not a sale price or appraisal");
  expect(container.textContent).toContain("not existing tenants’ bills");
  expect(container.querySelector("details")).toBeNull();
  expect(container.querySelectorAll('[data-distribution="box-range"]')).toHaveLength(2);
  expect(container.querySelector('[data-portrait="peers"] circle')).toBeNull();
  expect(container.textContent).toContain("Box: middle half of towns");
  expect(container.textContent).toContain("Observed range across towns");
  expect(screen.getByRole("link", { name: /Figures & sources/ }).getAttribute("href")).toBe("/nj/princeton/report#report-measures");
  expect(screen.queryByRole("link", { name: /living here cost/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Explore your buying plans/ })).toBeNull();
});

it("shows only an existing change whose end matches the displayed figure", () => {
  const change = { metric_id: "zhvi_sfr", start_value: 400000, end_value: 500000, pct_change: 25, window_start: "2021-09-30", window_end: "2026-09-30" } as PacketMetric;
  const histories = [{ metricId: "zhvi_sfr", observations: [{ metric_id: "zhvi_sfr", period_end: "2021-09-30", value: 400000 }, { metric_id: "zhvi_sfr", period_end: "2026-09-30", value: 500000 }] as Observation[] }];
  const { container, rerender } = render(createElement(PlaceMarketOpening, { ...props, histories, metrics: [change] }));
  expect(container.textContent).toContain("+25.0%");
  expect(container.textContent).toContain("Sep 2021");
  rerender(createElement(PlaceMarketOpening, { ...props, histories, metrics: [{ ...change, window_end: "2026-08-31" }] }));
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
  expect(container.textContent).toContain("60.0% Owner-occupied");
  expect(screen.getByRole("img", { name: /60.0% owner-occupied; 40.0% rented/ })).toBeTruthy();
  expect(container.textContent).toContain("2020–2024");
  expect(container.textContent).toContain("± 3.0 points");
});

it("browses actual peer values with keyboard controls and offers the selected comparison", () => {
  render(createElement(PlaceMarketOpening, props));
  const plot = screen.getByRole("slider", { name: /Explore typical home value across/ });
  expect(plot.getAttribute("aria-valuetext")).toContain("Princeton: $500,000");
  fireEvent.keyDown(plot, { key: "End" });
  expect(plot.getAttribute("aria-valuetext")).toBe("Upper Town: $900,000");
  expect(screen.getByRole("link", { name: /Compare/ }).getAttribute("href")).toBe("/compare?places=224,2");
  fireEvent.keyDown(plot, { key: "Home" });
  expect(plot.getAttribute("aria-valuetext")).toBe("Lower Town: $300,000");
});

it("collapses equal town values without invented spread or invalid coordinates",()=>{
 const cohorts=props.cohorts.map(c=>({...c,points:c.points.map(p=>({...p,value:c.metricId==='zhvi_sfr'?500000:2400}))}));
 const {container}=render(createElement(PlaceMarketOpening,{...props,cohorts}));
 const box=container.querySelector('[data-distribution="box-range"] rect');expect(box?.getAttribute('width')).toBe('0');
 expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
 const plot=screen.getByRole('slider',{name:/Explore typical home value across/});fireEvent.keyDown(plot,{key:'End'});expect(plot.getAttribute('aria-valuetext')).toContain('$500,000');
});

it("does not show an undated, mismatched-month or mismatched-value peer chart", () => {
  const { rerender } = render(createElement(PlaceMarketOpening, { ...props, cohorts: [{ ...props.cohorts[0], period: "2026-08-01" }] }));
  expect(screen.queryByRole("slider", { name: /across/ })).toBeNull();
  rerender(createElement(PlaceMarketOpening, { ...props, cohorts: [{ ...props.cohorts[0], points: props.cohorts[0].points.map(p => ({ ...p, value: p.value + 100 })) }] }));
  expect(screen.queryByRole("slider", { name: /across/ })).toBeNull();
});

it("scrubs historical dates with keyboard and keeps exact values readable", () => {
  const histories = [{ metricId: "zhvi_sfr", observations: [{ metric_id: "zhvi_sfr", period_end: "2021-09-30", value: 400000 }, { metric_id: "zhvi_sfr", period_end: "2026-09-30", value: 500000 }] as Observation[] }];
  render(createElement(PlaceMarketOpening, { ...props, histories }));
  const plot = screen.getByRole("slider", { name: /home value history/ });
  fireEvent.keyDown(plot, { key: "Home" });
  expect(plot.getAttribute("aria-valuetext")).toBe("Sep 2021: $400,000");
  fireEvent.keyDown(plot, { key: "ArrowRight" });
  expect(plot.getAttribute("aria-valuetext")).toBe("Sep 2026: $500,000");
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
