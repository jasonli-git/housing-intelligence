import { beforeEach, expect, it, vi } from "vitest";
import type { PacketLevel, Region } from "./api";

const mocks = vi.hoisted(() => ({ regions: vi.fn(), marketObservations: vi.fn() }));
vi.mock("./api", () => ({ api: mocks }));
import { marketPortraitData } from "./marketPortraitData";

const towns = Array.from({ length: 201 }, (_, i) => ({ region_id: i + 1, name: `Town ${i + 1}`, state_code: "NJ", level: "municipality" })) as Region[];
const levels = [{ metric_id: "zhvi_sfr", period_start: "2026-09-01" }, { metric_id: "zori_all", period_start: "2026-08-01" }] as PacketLevel[];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.regions.mockImplementation(async (q: string) => q.includes("level=county") ? { total: 0, items: [] } : { total: 201, items: towns });
  mocks.marketObservations.mockImplementation(async (_metric: string, ids: number[], period: string) => ({ regions: ids.map(id => ({ region_id: id, series: [{ period_start: period, value: id * 1000 }] })) }));
});

it("requests bounded batches at each metric's exact month and keeps the complete registry denominator", async () => {
  const result = await marketPortraitData("NJ", levels);
  expect(mocks.marketObservations).toHaveBeenCalledTimes(6);
  for (const [, ids, period] of mocks.marketObservations.mock.calls) {
    expect(ids.length).toBeLessThanOrEqual(100);
    expect(["2026-09-01", "2026-08-01"]).toContain(period);
  }
  expect(result.map(c => [c.period, c.total, c.points.length])).toEqual([["2026-09-01", 201, 201], ["2026-08-01", 201, 201]]);
});

it("refuses a truncated town registry instead of presenting it as statewide", async () => {
  mocks.regions.mockResolvedValue({ total: 202, items: towns });
  await expect(marketPortraitData("NJ", levels)).rejects.toThrow(/registry is incomplete/);
  expect(mocks.marketObservations).not.toHaveBeenCalled();
});

it("withholds a cohort if one batch is unavailable, rather than plotting a silent partial response", async () => {
  mocks.marketObservations.mockResolvedValueOnce(null);
  const result = await marketPortraitData("NJ", levels);
  expect(result[0].points).toEqual([]);
  expect(result[1].points).toHaveLength(201);
});

it("does not fetch peer observations for unsupported metric kinds", async () => {
  expect(await marketPortraitData("NJ", [{ metric_id: "sr1a_median_sale_price" } as PacketLevel])).toEqual([]);
  expect(mocks.marketObservations).not.toHaveBeenCalled();
});
