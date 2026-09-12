import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

function reply(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * The fetch layer's one rule: a 404 is an answer and anything else is a failure. On
 * 2026-09-12 the old version returned null for a 500, and eleven county reports were
 * built reading "No report" while the build reported success.
 */
describe("the API fetch layer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns null for a 404: the thing does not exist", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(404));
    vi.stubGlobal("fetch", fetch);

    expect(await api.sources()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a failure and returns the answer that follows", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(500))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(reply(200, [{ source_id: "census_acs" }]));
    vi.stubGlobal("fetch", fetch);

    const answer = api.sources();
    await vi.runAllTimersAsync();

    expect(await answer).toEqual([{ source_id: "census_acs" }]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws when the failure persists, so a build fails instead of baking an error page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500)));

    const answer = expect(api.sources()).rejects.toThrow(/failed 4 times \(last: HTTP 500\)/);
    await vi.runAllTimersAsync();
    await answer;
  });

  it("keeps at most five requests in flight, however many are asked for", async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return reply(200, []);
      }),
    );

    const answers = Promise.all(Array.from({ length: 20 }, () => api.sources()));
    await vi.runAllTimersAsync();

    expect(await answers).toHaveLength(20);
    expect(peak).toBe(5);
  });
});
