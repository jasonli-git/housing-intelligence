import { describe, expect, it } from "vitest";

import { CLOSING, FHA, njSellerFees } from "@/lib/costRules";
import { eachMonth, type Inputs, loanFor, mortgageInsurance, overYears, upFront } from "@/lib/ownership";

const BASE: Inputs = {
  price: 500_000,
  downPct: 20,
  ratePct: 6,
  taxYear: 12_000,
  insuranceYear: 1_200,
  utilitiesMonth: 300,
  hoaMonth: null,
  floodYear: null,
  pmiPct: null,
  upkeepPct: 1,
  closingPct: null,
  movingCost: null,
  repairsCost: null,
  years: 10,
  appreciationPct: 0,
  rentGrowthPct: 0,
  commissionPct: 5,
  rentMonth: 2_500,
};

describe("New Jersey's seller fees", () => {
  it("charges each band its own rate, on the schedule up to $350,000", () => {
    // $150,000 at $2.00, $50,000 at $3.35, $100,000 at $3.90, per $500.
    expect(njSellerFees(300_000)).toBeCloseTo(600 + 335 + 780);
  });
  it("switches to the higher schedule above $350,000", () => {
    // $150,000 at $2.90, $50,000 at $4.25, $300,000 at $4.80, per $500.
    expect(njSellerFees(500_000)).toBeCloseTo(870 + 425 + 2_880);
  });
  it("adds the graduated percent fee above $1 million, on the whole price", () => {
    const transfer = 870 + 425 + 3_360 + 3_180 + 1_740 + 6_050;
    expect(njSellerFees(1_500_000)).toBeCloseTo(transfer + 15_000);
    expect(njSellerFees(1_000_000)).toBeCloseTo(870 + 425 + 3_360 + 3_180 + 1_740);
  });
});

describe("the loan", () => {
  it("is an FHA loan at 3.5% down, its upfront premium financed", () => {
    const loan = loanFor({ price: 400_000, downPct: 3.5, ratePct: 6 });
    expect(loan.fha).toBe(true);
    expect(loan.base).toBeCloseTo(386_000);
    expect(loan.amount).toBeCloseTo(386_000 * (1 + FHA.upfront));
  });
  it("is conventional at 5% and up", () => {
    expect(loanFor({ price: 400_000, downPct: 5, ratePct: 6 }).fha).toBe(false);
  });
});

describe("mortgage insurance", () => {
  it("is FHA's yearly premium on the base loan, higher above the threshold", () => {
    const small = { ...BASE, price: 400_000, downPct: 3.5 };
    expect(mortgageInsurance(small, loanFor(small)).value).toBeCloseTo((386_000 * 0.0055) / 12);
    const large = { ...BASE, price: 800_000, downPct: 3.5 };
    expect(mortgageInsurance(large, loanFor(large)).value).toBeCloseTo((772_000 * 0.0075) / 12);
  });
  it("is Freddie Mac's range below 20% down, its middle used until a quote is entered", () => {
    const input = { ...BASE, downPct: 10 };
    const line = mortgageInsurance(input, loanFor(input));
    expect(line).toMatchObject({ basis: "range", low: 4.5 * 30, high: 4.5 * 70, value: 4.5 * 50 });
    const quoted = { ...input, pmiPct: 0.5 };
    expect(mortgageInsurance(quoted, loanFor(quoted))).toMatchObject({ basis: "reader", value: 187.5 });
  });
  it("is nothing at 20% down", () => {
    expect(mortgageInsurance(BASE, loanFor(BASE)).value).toBe(0);
  });
});

describe("each month", () => {
  it("adds every component, and money gone is all of it but principal", () => {
    const month = eachMonth(BASE);
    const parts = month.lines.reduce((sum, line) => sum + (line.value ?? 0), 0);
    expect(month.total).toBeCloseTo(parts);
    expect(month.gone).toBeCloseTo(month.total - month.principal);
    expect(month.lines.find((l) => l.key === "upkeep")?.value).toBeCloseTo(5_000 / 12);
  });
  it("is partial when a component every home has is missing, not when HOA fees are", () => {
    expect(eachMonth(BASE)).toMatchObject({ missing: [], optional: ["HOA or condo fees", "Flood insurance"] });
    expect(eachMonth({ ...BASE, taxYear: null }).missing).toEqual(["Property tax"]);
  });
});

describe("up front", () => {
  it("is the down payment and the CFPB's closing range, unless the reader sets one", () => {
    expect(upFront(BASE)).toMatchObject({
      down: 100_000,
      closingLow: 500_000 * CLOSING.low,
      closingHigh: 500_000 * CLOSING.high,
      low: 110_000,
      high: 125_000,
    });
    expect(upFront({ ...BASE, closingPct: 3, movingCost: 2_000 })).toMatchObject({ low: 117_000, high: 117_000 });
  });
});

describe("over the years", () => {
  it("sells at the price paid when prices are flat", () => {
    const years = overYears(BASE);
    expect(years.salePrice).toBe(500_000);
    expect(years.sellingCosts).toBeCloseTo(25_000 + njSellerFees(500_000));
    expect(years.net).toBeCloseTo(years.upfront + years.paid - years.equity);
    expect(years.rent).toBe(2_500 * 120);
  });
  it("stops conventional mortgage insurance at 78% of the price, never FHA's", () => {
    const thirty = (input: Inputs) => {
      const month = eachMonth(input);
      const mi = month.lines.find((l) => l.key === "mi")?.value ?? 0;
      return { paid: overYears({ ...input, years: 30 }).paid, always: (month.total - (month.lines.find((l) => l.key === "utilities")?.value ?? 0)) * 360, mi };
    };
    const conventional = thirty({ ...BASE, downPct: 10 });
    expect(conventional.paid).toBeLessThan(conventional.always - conventional.mi * 12);
    const fha = thirty({ ...BASE, downPct: 3.5 });
    expect(fha.paid).toBeCloseTo(fha.always);
  });
});
