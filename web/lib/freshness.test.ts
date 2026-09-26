import { describe, expect, it } from "vitest";

import type { SourceFreshness } from "@/lib/api";
import {
  checkedDaysBefore,
  dayLabel,
  nextLabel,
  sortForDisplay,
  STATUS_COPY,
  builtAgo,
  stillUnderWay,
  throughLabel,
} from "@/lib/freshness";

function source(fields: Partial<SourceFreshness>): SourceFreshness {
  return {
    source_id: "x",
    name: "X",
    publisher: "P",
    cadence: "annual",
    status: "current",
    period_observed_start: null,
    period_observed_end: null,
    published: null,
    checked_at: null,
    pending: null,
    pending_from: null,
    acquired_at: null,
    ...fields,
  };
}

describe("sortForDisplay", () => {
  it("puts problems first, then orders by name within a status", () => {
    const sorted = sortForDisplay([
      source({ name: "Zillow", status: "not_tracked" }),
      source({ name: "BLS", status: "current" }),
      source({ name: "HUD FMR", status: "pending" }),
      source({ name: "ACS", status: "current" }),
      source({ name: "MOD-IV", status: "unreachable" }),
    ]);
    expect(sorted.map((s) => s.name)).toEqual(["MOD-IV", "HUD FMR", "ACS", "BLS", "Zillow"]);
  });

  it("does not reorder the array it was given", () => {
    const input = [source({ name: "B" }), source({ name: "A" })];
    sortForDisplay(input);
    expect(input.map((s) => s.name)).toEqual(["B", "A"]);
  });
});

describe("dayLabel", () => {
  it("reads the calendar day from the string, never through a local-time Date", () => {
    // 00:51 UTC is the previous evening in New York; the label stays the UTC day.
    expect(dayLabel("2026-09-26T00:51:05.932711Z")).toBe("Sep 26, 2026");
    expect(dayLabel("2025-09-11")).toBe("Sep 11, 2025");
  });

  it("says nothing rather than inventing a date", () => {
    expect(dayLabel(null)).toBe("—");
  });
});

describe("throughLabel", () => {
  it("names the month, so a 31 December end does not read as a whole year", () => {
    expect(throughLabel("2025-12-31")).toBe("Dec 2025");
    expect(throughLabel("2026-07-31")).toBe("Jul 2026");
    expect(throughLabel(null)).toBe("—");
  });
});

describe("stillUnderWay", () => {
  it("flags a period that ends after the build, by UTC day", () => {
    // HUD's FY2026 Fair Market Rents run to 30 September 2026.
    expect(stillUnderWay("2026-09-26T08:00:00Z", "2026-09-30")).toBe(true);
    expect(stillUnderWay("2026-09-26T08:00:00Z", "2026-09-26")).toBe(false);
    expect(stillUnderWay("2026-09-26T08:00:00Z", "2026-07-31")).toBe(false);
    expect(stillUnderWay("2026-09-26T08:00:00Z", null)).toBe(false);
  });
});

describe("nextLabel", () => {
  it("states a next release only where the publisher has", () => {
    expect(nextLabel(source({ pending: "2027", pending_from: "2026-10-01" }))).toBe(
      "2027, from Oct 1, 2026",
    );
    expect(nextLabel(source({ pending: "2027" }))).toBe("2027");
    expect(nextLabel(source({}))).toBe("—");
  });
});

describe("checkedDaysBefore", () => {
  it("counts whole UTC days between the last check and the build", () => {
    expect(checkedDaysBefore("2026-09-26T08:00:00Z", "2026-09-26T00:51:00Z")).toBe(0);
    expect(checkedDaysBefore("2026-10-05T08:00:00Z", "2026-09-26T00:51:00Z")).toBe(9);
    expect(checkedDaysBefore("2026-09-26T08:00:00Z", null)).toBeNull();
  });
});

describe("STATUS_COPY", () => {
  it("never claims a source with no release schedule was checked", () => {
    // The page cannot back "checked" for a revalidated source: that timestamp is not
    // recorded anywhere it reads from (hip/warehouse/freshness.py).
    expect(STATUS_COPY.not_tracked.means).toContain("does not yet record when it was last read");
  });
});

describe("builtAgo", () => {
  it("counts whole UTC days since the build, as a reader would say it", () => {
    const built = "2026-09-26T08:00:00Z";
    expect(builtAgo(built, new Date("2026-09-26T23:59:00Z"))).toBe("today");
    expect(builtAgo(built, new Date("2026-09-27T00:01:00Z"))).toBe("yesterday");
    expect(builtAgo(built, new Date("2026-10-06T12:00:00Z"))).toBe("10 days ago");
  });

  it("never reads a clock set behind the build as the future", () => {
    expect(builtAgo("2026-09-26T08:00:00Z", new Date("2026-09-20T00:00:00Z"))).toBe("today");
  });
});

describe("STATUS_COPY", () => {
  it("says every status is as of the build, not as of the reading", () => {
    for (const status of ["current", "pending", "unreachable"] as const) {
      expect(STATUS_COPY[status].means).toMatch(/^When this page was built/);
    }
  });
});
