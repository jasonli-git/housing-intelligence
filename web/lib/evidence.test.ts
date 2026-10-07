import { describe, expect, it } from "vitest";

import { judge, judgeAnswer, THIN_SALES, weaker, WIDE_MARGIN } from "./evidence";

const figure = { metric_id: "acs_median_hh_income", value: 100_000, period_end: "2024-12-31", match_method: "fips" };

describe("evidence strength", () => {
  it("is strong for an exact, current figure with a narrow margin", () => {
    expect(judge({ ...figure, survey: true, margin_of_error: 5_000 }, { newest: { acs_median_hh_income: "2024-12-31" } }))
      .toEqual({ strength: "strong", reasons: [] });
  });

  it("is partial for a figure estimated from census areas, or a county standing in", () => {
    expect(judge({ ...figure, match_method: "tract_homes" }).reasons).toEqual(["estimated for this place from its census areas"]);
    expect(judge({ ...figure, match_method: "block_crosswalk" }).strength).toBe("partial");
    expect(judge(figure, { standIn: true }).reasons).toEqual(["a county figure standing in for the town"]);
  });

  it("is partial when the place's figure is behind its source's newest edition", () => {
    const old = { metric_id: "hmda_median_income", value: 152_000, period_end: "2021-12-31", match_method: "fips" };
    expect(judge(old, { newest: { hmda_median_income: "2025-12-31" } }).reasons)
      .toEqual(["from 2021; the source has published 2025 elsewhere"]);
    // A later month of the same year is not a missed edition.
    expect(judge({ ...old, period_end: "2025-06-30" }, { newest: { hmda_median_income: "2025-12-31" } }).strength).toBe("strong");
  });

  it("is partial for a wide or missing survey margin", () => {
    expect(judge({ ...figure, survey: true, margin_of_error: figure.value * WIDE_MARGIN }).reasons)
      .toEqual(["a survey estimate with a wide margin"]);
    expect(judge({ ...figure, survey: true, margin_of_error: null }).reasons)
      .toEqual(["a survey estimate with no published margin"]);
    // Administrative records carry no margin and need none.
    expect(judge({ ...figure, survey: false, margin_of_error: null }).strength).toBe("strong");
  });

  it("is partial for a sales figure resting on few sales", () => {
    const price = { metric_id: "sr1a_median_sale_price", value: 400_000, period_end: "2026-06-30", match_method: "nj_cd_code", source_id: "nj_sr1a" };
    expect(judge(price, { sales: THIN_SALES - 1 }).reasons).toEqual([`fewer than ${THIN_SALES} recorded sales`]);
    expect(judge(price, { sales: THIN_SALES }).strength).toBe("strong");
  });

  it("makes an answer as weak as its weakest input, and limited when one is missing", () => {
    expect(weaker("strong", "partial")).toBe("partial");
    expect(judgeAnswer([
      { label: "price", figure },
      { label: "tax", figure: { ...figure, match_method: "tract_homes" } },
    ])).toEqual({ strength: "partial", reasons: ["tax: estimated for this place from its census areas"] });
    expect(judgeAnswer([{ label: "price", figure }, { label: "tax", figure: null }]))
      .toEqual({ strength: "limited", reasons: ["no tax figure for this place"] });
  });
});
