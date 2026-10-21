import { expect, it } from "vitest";
import { ownershipInputs } from "./budgetScenario";
import { overYears } from "./ownership";
import { twoPaths } from "./twoPaths";
const input=ownershipInputs({state: "NJ", price:400000,ratePct:6,taxYear:6000,insuranceYear:1200,utilitiesMonth:200,rentMonth:2000});
it("reuses the guide's cost engine at every whole year",()=>{
  const result=twoPaths(input);
  expect(result.points).toHaveLength(30);
  expect(result.selected).toEqual(overYears(input));
  expect(result.down).toBe(80000);
  expect(result.valueChange).toBe(0);
  expect(result.spent).toBeCloseTo(result.selected.net);
  expect(result.selected.equity).toBeCloseTo(result.down+result.principalPaid-result.selected.sellingCosts);
});
it("keeps assumed gains separate from spending and flags missing costs",()=>{
  const result=twoPaths({...input,appreciationPct:3,insuranceYear:null,years:5});
  expect(result.valueChange).toBeGreaterThan(0);
  expect(result.spent-result.valueChange).toBeCloseTo(result.selected.net);
  expect(result.selected.missing).toContain("Homeowners insurance");
  expect(result.selected.years).toBe(5);
});
it("preserves financed FHA premiums in spending",()=>{
  const result=twoPaths({...input,downPct:3.5});
  expect(result.spent).toBeCloseTo(result.selected.net);
  expect(result.down).toBe(14000);
  expect(result.selected.equity).toBeLessThan(result.down+result.principalPaid-result.selected.sellingCosts);
});
