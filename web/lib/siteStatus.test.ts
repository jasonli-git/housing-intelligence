import { describe, expect, it } from "vitest";

import { statusWords } from "./siteStatus";

const now = new Date("2026-10-21T12:00:00Z");

describe("the status link", () => {
  it("names the schedule when no check has been published or it cannot be read", () => {
    expect(statusWords(null, now)).toMatchObject({ kicker: "Source checks", word: "scheduled", when: "Fridays" });
    expect(statusWords({ checked_at: "garbage", outcome: "current" }, now).when).toBe("Fridays");
  });
  it("says when the sources were last checked", () => {
    expect(statusWords({ checked_at: "2026-10-17T13:05:00+00:00", outcome: "current" }, now)).toEqual({
      kicker: "Sources checked", word: "", when: "Oct 17", overdue: false,
    });
  });
  it("says when a publisher could not be reached", () => {
    expect(statusWords({ checked_at: "2026-10-17T13:05:00+00:00", outcome: "unreachable" }, now).when).toBe("Oct 17 · some unreachable");
  });
  it("calls a check more than nine days old overdue", () => {
    expect(statusWords({ checked_at: "2026-10-10T13:05:00+00:00", outcome: "current" }, now)).toEqual({
      kicker: "Source check overdue", word: "", when: "· last Oct 10", overdue: true,
    });
  });
});
