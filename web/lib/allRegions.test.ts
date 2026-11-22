import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());

it("reads every page of a state's places, not the endpoint's first 1,000", async () => {
  // Pennsylvania's 2,571 towns (Milestone 63), served 1,000 at a time.
  const asked: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    asked.push(url);
    const offset = Number(new URL(url).searchParams.get("offset"));
    const items = Array.from({ length: Math.min(1000, 2571 - offset) }, (_, i) => ({ region_id: offset + i + 1 }));
    return new Response(JSON.stringify({ total: 2571, items }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const all = await api.allRegions("state=PA&level=municipality");
  expect(all?.items).toHaveLength(2571);
  expect(all?.total).toBe(2571);
  expect(asked.map((u) => new URL(u).searchParams.get("offset"))).toEqual(["0", "1000", "2000"]);
});
