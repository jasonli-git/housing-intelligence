import { describe, expect, it } from "vitest";

import { placeCaveats, scopesFor } from "@/lib/caveats";

const LEDGER = ["zhvi_sfr", "zori_all", "rent_to_income", "acs_median_hh_income", "acs_population"];
const CURRENT = ["acs_median_hh_income", "acs_population", "chas_renter_cost_burden"];

describe("placeCaveats", () => {
  it("sets a caveat that qualifies one row directly under it", () => {
    const placed = placeCaveats([LEDGER], [{ text: "rent", metric_ids: ["zori_all"] }]);

    expect(placed.tables[0].inline.get("zori_all")).toEqual(["rent"]);
    expect(placed.tables[0].notes).toEqual([]);
  });

  it("letters a caveat that qualifies several rows and sets it under the first table", () => {
    const placed = placeCaveats(
      [LEDGER, CURRENT],
      [{ text: "overlap", metric_ids: ["acs_median_hh_income", "acs_population"] }],
    );

    const [ledger, current] = placed.tables;
    expect(ledger.marks.get("acs_median_hh_income")).toEqual(["a"]);
    expect(ledger.marks.get("acs_population")).toEqual(["a"]);
    expect(ledger.notes).toEqual([{ letter: "a", text: "overlap" }]);
    // Marked again below, and pointed back to rather than printed twice.
    expect(current.marks.get("acs_population")).toEqual(["a"]);
    expect(current.notes).toEqual([]);
    expect(current.earlier).toEqual(["a"]);
  });

  it("counts rows across tables, so one row in each is two rows, not one", () => {
    const placed = placeCaveats(
      [["zori_all"], ["zori_all"]],
      [{ text: "rent", metric_ids: ["zori_all"] }],
    );

    expect(placed.tables[0].notes).toEqual([{ letter: "a", text: "rent" }]);
    expect(placed.tables[1].earlier).toEqual(["a"]);
  });

  it("keeps a region-wide caveat, and one about an unshown metric, under the tables", () => {
    const placed = placeCaveats(
      [LEDGER],
      [
        { text: "allocated", metric_ids: [] },
        { text: "mortgage", metric_ids: ["mortgage_rate_30y"] },
      ],
    );

    expect(placed.general).toEqual(["allocated", "mortgage"]);
  });

  it("letters in arrival order and skips single-row caveats when counting", () => {
    const placed = placeCaveats(
      [LEDGER],
      [
        { text: "first", metric_ids: ["zhvi_sfr", "zori_all"] },
        { text: "only one", metric_ids: ["rent_to_income"] },
        { text: "second", metric_ids: ["acs_median_hh_income", "acs_population"] },
      ],
    );

    expect(placed.tables[0].notes.map((n) => n.letter)).toEqual(["a", "b"]);
    expect(placed.tables[0].inline.get("rent_to_income")).toEqual(["only one"]);
  });
});

describe("scopesFor", () => {
  it("keeps the packet's caveats and order, borrowing each scope by its text", () => {
    const scopes = scopesFor(
      ["overlap", "allocated with weights: area"],
      [
        { text: "overlap", metric_ids: ["acs_population"] },
        { text: "allocated", metric_ids: [] },
      ],
    );

    expect(scopes).toEqual([
      { text: "overlap", metric_ids: ["acs_population"] },
      { text: "allocated with weights: area", metric_ids: [] },
    ]);
  });
});
