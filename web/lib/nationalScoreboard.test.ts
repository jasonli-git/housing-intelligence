import { describe, expect, it } from "vitest";
import { annualChanges, compact, latestPrice, marketTakeaways, monthlyPayment, oneIn, scoreboard, type ScoreSeries } from "./nationalScoreboard";

const month = (date: string, value: number) => ({ period_start: `${date}-01`, period_end: `${date}-28`, value });
const day = (date: string, value: number) => ({ period_start: date, period_end: date, value });
const empty: ScoreSeries = { rate: null, hpi: [], listings: [], priceCutShare: [], daysOnMarket: [], rentCpi: [], starts: [], newHomeSupply: [] };
const tile = (series: Partial<ScoreSeries>, id: string) => scoreboard({ ...empty, ...series }).find((t) => t.id === id);

describe("the national scoreboard", () => {
  it("drops a tile whose series is empty, and keeps reading order", () => {
    expect(scoreboard(empty)).toEqual([]);
    const ids = scoreboard({ ...empty, starts: [month("2026-09", 1_221_000)], listings: [month("2026-09", 1_161_615)] }).map((t) => t.id);
    expect(ids).toEqual(["listings", "starts"]);
  });

  it("compares a level with the same month a year earlier, never the nearest", () => {
    const listings = tile({ listings: [month("2025-09", 1_102_006), month("2026-09", 1_161_615)] }, "listings")!;
    expect(listings.value).toBe("1.16M");
    expect(listings.change).toBe("+5.4%");
    expect(listings.tone).toBe("easier");
    expect(listings.period).toBe("Sep 2026");
    const gap = tile({ listings: [month("2025-08", 1_000_000), month("2026-09", 1_161_615)] }, "listings")!;
    expect(gap.change).toBeNull();
    expect(gap.summary).toContain("No comparable reading a year earlier");
  });

  it("reads a fall in starts as harder and a cut share as neither", () => {
    expect(tile({ starts: [month("2025-09", 1_319_000), month("2026-09", 1_221_000)] }, "starts")).toMatchObject({ value: "1.22M/yr", change: "−7.4%", tone: "harder", direction: "down" });
    expect(tile({ priceCutShare: [month("2025-09", 35.1), month("2026-09", 35.0)] }, "cuts")).toMatchObject({ change: "−0.1 pts", tone: "neutral" });
  });

  it("calls an unchanged figure flat, and speaks the change in words", () => {
    const supply = tile({ newHomeSupply: [month("2025-08", 8.5), month("2026-08", 8.5)] }, "supply")!;
    expect(supply).toMatchObject({ value: "8.5 mo", change: "0.0 mo", direction: "flat", tone: "flat" });
    const days = tile({ daysOnMarket: [month("2025-09", 62), month("2026-09", 61)] }, "days")!;
    expect(days.change).toBe("−1 day");
    expect(days.summary).toBe("Days on market: 61 days, Sep 2026. minus 1 day from a year earlier, harder for buyers and renters.");
  });

  it("shows rent and prices as annual changes, compared with the annual change a year before", () => {
    const rows = [month("2024-09", 100), month("2025-09", 104), month("2026-09", 106.08)];
    expect(annualChanges(rows).map((r) => r.value.toFixed(1))).toEqual(["4.0", "2.0"]);
    expect(tile({ rentCpi: rows }, "rent")).toMatchObject({ value: "+2.0%", change: "−2.0 pts", tone: "easier" });
  });

  it("compares this week's rate with the survey week 52 weeks earlier", () => {
    const rate = tile({ rate: { metricId: "mortgage_rate_30y_weekly", readings: [day("2025-10-23", 6.19), day("2026-10-22", 6.32)] } }, "rate")!;
    expect(rate).toMatchObject({ value: "6.32%", change: "+0.13 pts", tone: "harder", period: "Oct 22" });
    const far = tile({ rate: { metricId: "mortgage_rate_30y_weekly", readings: [day("2025-10-10", 6.19), day("2026-10-22", 6.32)] } }, "rate")!;
    expect(far.change).toBeNull();
  });

  it("writes counts compactly", () => {
    expect(compact(1_161_615)).toBe("1.16M");
    expect(compact(407_028)).toBe("407K");
    expect(compact(61)).toBe("61");
  });

  it("says what the figures mean for buyers and renters, in everyday terms", () => {
    const tiles = scoreboard({
      ...empty,
      rate: { metricId: "mortgage_rate_30y_weekly", readings: [day("2025-10-23", 6.19), day("2026-10-22", 7.32)] },
      hpi: [month("2024-07", 100), month("2025-07", 102.7), month("2026-07", 105.37)],
      listings: [month("2025-09", 1_102_006), month("2026-09", 1_161_615)],
      daysOnMarket: [month("2025-09", 62), month("2026-09", 61)],
      priceCutShare: [month("2025-09", 35.1), month("2026-09", 35.0)],
      starts: [month("2025-09", 1_319_000), month("2026-09", 1_221_000)],
      newHomeSupply: [month("2025-08", 8.5), month("2026-08", 8.5)],
      rentCpi: [month("2024-09", 100), month("2025-09", 103.4), month("2026-09", 106.3)],
    });
    expect(marketTakeaways(tiles, 410_700)).toEqual([
      { id: "rate", headline: "Borrowing costs more", detail: "A typical 30-year mortgage rate is 7.32%, against 6.19% a year ago. On a typical new home ($410,700, with 20% down), that is about $250 more a month." },
      { id: "choice", headline: "More homes to choose from", detail: "5.4% more homes are for sale than a year ago. A typical home sells in 61 days, and about 1 in 3 listings has had its price cut." },
      { id: "prices", headline: "Prices still rising", detail: "Prices of the same homes rose 2.6% over the past year, slower than the 2.7% the year before." },
      { id: "rent", headline: "Rent increases easing", detail: "Rents rose 2.8% over the past year, against 3.4% the year before." },
      { id: "building", headline: "Fewer homes being built", detail: "Construction began on 7.4% fewer homes than a year ago. Unsold new homes would take 8.5 months to sell at today's pace, more than the roughly six months usually read as balanced." },
    ]);
    expect(marketTakeaways(tiles)[0].detail).toBe("A typical 30-year mortgage rate is 7.32%, against 6.19% a year ago.");
    expect(marketTakeaways(scoreboard({ ...empty, listings: [month("2026-09", 1_161_615)] }))).toEqual([]);
    const alike = marketTakeaways(scoreboard({ ...empty, hpi: [month("2024-07", 100), month("2025-07", 102.64), month("2026-07", 105.29)] }));
    expect(alike[0].detail).toBe("Prices of the same homes rose 2.6% over the past year, about as fast as the year before.");
  });

  it("prices a rate change as a monthly payment", () => {
    expect(Math.round(monthlyPayment(400_000, 7.32))).toBe(2748);
    expect(Math.round(monthlyPayment(400_000, 6.19))).toBe(2447);
    expect(latestPrice([month("2026-01", 408_500), month("2026-04", 410_700)])).toBe(410_700);
    expect(latestPrice(undefined)).toBeNull();
    expect(oneIn(35)).toBe("about 1 in 3");
    expect(oneIn(12)).toBe("about 1 in 8");
  });

  it("never explains or predicts", () => {
    const tiles = scoreboard({ ...empty, rate: { metricId: "mortgage_rate_30y", readings: [month("2025-09", 6), month("2026-09", 7)] }, starts: [month("2025-09", 1), month("2026-09", 2)] });
    for (const t of marketTakeaways(tiles)) expect(`${t.headline} ${t.detail}`).not.toMatch(/because|due to|driven|will|expect|likely/i);
  });
});
