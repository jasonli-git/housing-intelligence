import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HowUnusual } from "./HowUnusual";
import type { Persistence } from "@/lib/api";

const data: Persistence = {
  region_id: 1, first_year: 2000, last_year: 2024, years: 25, missing_years: [],
  vs_median: 20, vs_median_low: 15, vs_median_high: 25,
  rank: 1, rank_best: 1, rank_worst: 2, peak_year: 2024, peak_vs_median: 20,
  above_median_since: 2020, episodes: [], series: [{year: 2000, vs_median: -10}, {year: 2024, vs_median: 20}],
  validation: null, withheld: null, fetched_at: null, sources: [],
};
describe("historical exhibit", () => {
  it("shows the graph and uncertainty without an enclosing disclosure", () => {
    const html = renderToStaticMarkup(<HowUnusual name="New Jersey" data={data} exhibit />);
    expect(html).toContain("2024: 20% above the usual level since 2000.");
    expect(html).toContain("between 15% above and 25% above");
    expect(html).toContain("Historical comparison—not a forecast.");
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain("between the 1st and 2nd highest");
  });
  it("does not expose withheld figures even in methodology", () => {
    const html = renderToStaticMarkup(<HowUnusual name="New Jersey" data={{...data, withheld: "Insufficient observations"}} exhibit />);
    expect(html).toContain("Insufficient observations");
    expect(html).not.toContain("20% above");
    expect(html).not.toContain("<svg");
  });
  it("keeps the existing county presentation unchanged by default", () => {
    const html = renderToStaticMarkup(<HowUnusual name="Somerset County" data={data} />);
    expect(html).toContain("Is this unusual for here?");
    expect(html).toContain("in Somerset County were");
    expect(html).not.toContain("history-exhibit");
  });
});
