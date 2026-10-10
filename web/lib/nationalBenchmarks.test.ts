import { describe, expect, it } from "vitest";
import { annualHomePriceChange, annualHomePriceTrend, mortgageRateTrend, trendGeometry } from "./nationalBenchmarks";
const row = (date: string, value: number) => ({ period_start: `${date}-01`, period_end: `${date}-28`, value });
describe("annual national home-price change", () => {
  it("uses the same month last year, with unsorted observations", () => {
    const result = annualHomePriceChange([row("2026-07", 110), row("2025-07", 100), row("2025-06", 80)]);
    expect(result?.pct_change).toBeCloseTo(10);
    expect(result?.period_start).toBe("2025-07-01");
    expect(result?.period_end).toBe("2026-07-28");
  });
  it("does not backfill a missing year-ago month or drop a missing latest comparison", () => {
    expect(annualHomePriceChange([row("2025-06", 100), row("2026-07", 110)])).toBeNull();
    expect(annualHomePriceChange([])).toBeNull();
  });
  it("suppresses invalid indexes and preserves declines", () => {
    for (const value of [0, -1, NaN, Infinity]) {
      expect(annualHomePriceChange([row("2025-07", value), row("2026-07", 100)])).toBeNull();
      expect(annualHomePriceChange([row("2025-07", 100), row("2026-07", value)])).toBeNull();
    }
    expect(annualHomePriceChange([row("2025-07", 100), row("2026-07", 90)])?.pct_change).toBeCloseTo(-10);
  });
});

describe("national trends", () => {
  it("plots annual changes, with twelve calendar months and missing baselines as gaps", () => {
    const points = annualHomePriceTrend([row("2026-07", 110), row("2025-07", 100), row("2026-06", 108), row("2025-06", 100), row("2026-05", 104)]);
    expect(points).toHaveLength(12);
    expect(points[0].date).toBe("2025-08-01");
    expect(points.at(-1)?.value).toBeCloseTo(10);
    expect(points.at(-2)?.value).toBeCloseTo(8);
    expect(points.at(-3)?.value).toBeNull();
    expect(annualHomePriceTrend([])).toEqual([]);
  });
  it("clips rate history to one year, sorts it and does not bridge missing weeks", () => {
    const points = mortgageRateTrend([row("2026-07", 6), row("2024-07", 8), row("2026-06", 7)], true);
    expect(points).toEqual([{ date: "2026-06-01", value: 7 }, { date: "2026-07-01", value: null }, { date: "2026-07-01", value: 6 }]);
    expect(mortgageRateTrend([row("2026-06", 7), row("2026-07", 6)], false).filter(p => p.value === null)).toHaveLength(0);
    expect(mortgageRateTrend([row("2026-07", NaN)], true)[0].value).toBeNull();
  });
  it("uses actual elapsed time, not equal spacing, and breaks the line at gaps", () => {
    const plot = trendGeometry([{ date: "2026-01-01", value: -2 }, { date: "2026-01-02", value: 0 }, { date: "2026-01-03", value: null }, { date: "2026-01-11", value: 2 }]);
    expect(plot?.path).toBe("M42.00,64.00 L67.00,40.00 M292.00,16.00");
    expect(plot?.min).toBe(-2);
    expect(plot?.max).toBe(2);
  });
  it("keeps constant series flat and suppresses insufficient or invalid histories", () => {
    expect(trendGeometry([{ date: "2026-01-01", value: 5 }, { date: "2026-02-01", value: 5 }])?.path).toBe("M42.00,40.00 L292.00,40.00");
    expect(trendGeometry([])).toBeNull();
    expect(trendGeometry([{ date: "2026-01-01", value: 5 }])).toBeNull();
    expect(trendGeometry([{ date: "2026-01-01", value: NaN }, { date: "2026-02-01", value: 5 }])).toBeNull();
  });
});
