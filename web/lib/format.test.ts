import { describe, expect, it } from "vitest";

import { formatChange, formatValue } from "@/lib/format";

/**
 * These must agree with `format_value` in `src/hip/packets/report.py`. The packet
 * carries a `unit` and each medium formats for itself, so the two implementations are
 * checked against the same expectations rather than against each other.
 */
describe("formatValue", () => {
  it("renders money without cents", () => {
    expect(formatValue(453317.4, "usd")).toBe("$453,317");
    expect(formatValue(2622, "usd_month")).toBe("$2,622");
  });

  it("renders a percentage to one decimal and a ratio to two", () => {
    expect(formatValue(4.5, "percent")).toBe("4.5%");
    expect(formatValue(4.1523, "ratio")).toBe("4.15");
  });

  it("renders a count as a whole number", () => {
    expect(formatValue(383286, "count")).toBe("383,286");
  });

  it("drops a trailing zero on an unrecognised unit", () => {
    expect(formatValue(233, "index")).toBe("233");
    expect(formatValue(233.46, "index")).toBe("233.5");
  });

  it("keeps a negative readable", () => {
    expect(formatValue(-1987, "count")).toBe("-1,987");
  });
});

describe("formatChange", () => {
  it("always carries a sign, because an unsigned change is ambiguous", () => {
    expect(formatChange(37.69)).toBe("+37.7%");
    expect(formatChange(-1.83)).toBe("-1.8%");
    expect(formatChange(0)).toBe("+0.0%");
  });
});
