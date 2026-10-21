import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QuietProfile } from "./QuietCounty";

const item = { metric_id: "acs_renter_cost_burden", label: "Renters spending over 30%", value: "36.1%", definition: "x", context: null };

describe("a figure that changed after first publication", () => {
  it("says when, what it first said, and links every change", () => {
    const html = renderToStaticMarkup(<QuietProfile items={[{ ...item, updated: { from: "33.1%", on: "2026-09-26" } }]} />);
    expect(html).toContain("Updated Sep 26, 2026");
    expect(html).toContain("first published as 33.1%");
    expect(html).toContain('href="/changes"');
  });
  it("is absent from a figure that never changed", () => {
    expect(renderToStaticMarkup(<QuietProfile items={[item]} />)).not.toContain("figure-updated");
  });
});
