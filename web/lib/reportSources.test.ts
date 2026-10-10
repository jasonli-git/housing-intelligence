import {describe, expect, it} from "vitest";
import {reportSourceLabel} from "./reportSources";

describe("report source labels", () => {
  it("distinguishes datasets from the same publisher", () => {
    expect(reportSourceLabel("zillow_zhvi")).toBe("Zillow ZHVI");
    expect(reportSourceLabel("zillow_zori")).toBe("Zillow ZORI");
    expect(reportSourceLabel("census_acs")).toBe("Census ACS");
  });
  it("preserves unknown registry names and missing-source semantics", () => {
    expect(reportSourceLabel("new", "New official source")).toBe("New official source");
    expect(reportSourceLabel("new")).toBe("new");
    expect(reportSourceLabel(null)).toBe("—");
  });
});
