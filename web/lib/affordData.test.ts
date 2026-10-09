import { beforeEach, expect, it, vi } from "vitest";
import { api, nationalMortgageRate } from "./api";
import { affordData } from "./affordData";

vi.mock("./api", () => ({
  api: { regions: vi.fn(), metrics: vi.fn(), rankings: vi.fn(), costObservations: vi.fn() },
  nationalMortgageRate: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.regions).mockImplementation(async (query) => ({ items: query.includes("county")
    ? [{ region_id: 1, name: "Test County", level: "county", parent_id: null }]
    : Array.from({ length: 95 }, (_, i) => ({ region_id: i + 2, name: `Town ${i}`, level: "municipality", parent_id: 1 })), total: 1 }) as never);
  vi.mocked(api.metrics).mockResolvedValue([]);
  vi.mocked(nationalMortgageRate).mockResolvedValue({ value: 6, period_start: "2026-09-01" } as never);
  vi.mocked(api.rankings).mockResolvedValue({ items: Array.from({ length: 96 }, (_, i) => ({ region_id: i + 1, value: 1000 })) } as never);
  vi.mocked(api.costObservations).mockImplementation(async (metric, ids) => ({ regions: ids.map((id) => ({
    region_id: id, series: [{ value: 12, period_start: "2018-01-01" }, { value: metric.includes("water") ? 120 : 100, period_start: "2019-01-01" }],
  })) }) as never);
});

it("reads unranked cost inputs in bounded batches and uses the latest annual observations", async () => {
  const data = await affordData();
  expect(data?.counties[0]).toMatchObject({ insurance: 100, utilities: 210 });
  expect(data?.towns).toHaveLength(95);
  expect(data?.towns[94]).toMatchObject({ insurance: 100, utilities: 210 });
  expect(api.costObservations).toHaveBeenCalledTimes(8);
  for (const [, ids] of vi.mocked(api.costObservations).mock.calls) expect(ids.length).toBeLessThanOrEqual(90);
  for (const [metric] of vi.mocked(api.rankings).mock.calls) expect(metric).not.toContain("acs_");
});

it("keeps missing observations missing instead of inventing a zero insurance or utility cost", async () => {
  vi.mocked(api.costObservations).mockResolvedValue(null);
  const data = await affordData();
  expect(data?.counties[0]).toMatchObject({ insurance: null, utilities: null });
});

it("keeps towns without indexed prices or rents selectable without substituting sale prices", async () => {
  vi.mocked(api.rankings).mockResolvedValue({ items: [] } as never);
  const data = await affordData();
  expect(data?.towns).toHaveLength(95);
  expect(data?.towns[0]).toMatchObject({ home: null, rent: null });
});

it("prices every place from one source, Zillow's index, never mixing in recorded sales (#359)", async () => {
  // The comparison ranks towns against each other, so every price must be the same
  // measure: Zillow's typical home value. A town priced from its recorded sales (#187)
  // would be a different measure on the same scale. Any metric added here fails this
  // test until someone decides the comparison can hold it.
  await affordData();
  const read = new Set(vi.mocked(api.rankings).mock.calls.map(([metric]) => metric));
  expect([...read].sort()).toEqual(["modiv_median_tax_bill", "zhvi_sfr", "zori_all"]);
  for (const [metric] of vi.mocked(api.costObservations).mock.calls) {
    expect(metric).toMatch(/^acs_median_(home_insurance|electricity|gas|water_sewer)$/);
  }
});

