// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TwoPaths } from "./TwoPaths";
import { ownershipInputs } from "@/lib/budgetScenario";
afterEach(cleanup);
const input=ownershipInputs({price:400000,ratePct:6,taxYear:null,insuranceYear:1200,utilitiesMonth:200,rentMonth:2000});
it("exposes separate cash concepts and accessible controls without forecasting",()=>{
  const onYears=vi.fn(),onFlat=vi.fn();
  render(<TwoPaths input={{...input,appreciationPct:3}} onYears={onYears} onFlat={onFlat} onPrice={vi.fn()} onDown={vi.fn()} onRate={vi.fn()} onUpkeep={vi.fn()} />);
  fireEvent.change(screen.getByRole("slider",{name:/Explore year/}),{target:{value:"5"}});
  expect(onYears).toHaveBeenCalledWith(5);
  fireEvent.click(screen.getByRole("button",{name:"Try no growth"}));
  expect(onFlat).toHaveBeenCalled();
  expect(screen.getByText("Money spent, including sale fees")).toBeTruthy();
  expect(screen.getByText("Principal paid down")).toBeTruthy();
  expect(screen.getByText("Down payment not tied up")).toBeTruthy();
  expect(screen.getByText(/Missing is not zero/)).toBeTruthy();
  expect(screen.getByText(/No investment return assumed/)).toBeTruthy();
});
it("does not call a sale shortfall cash returned to the buyer",()=>{
  render(<TwoPaths input={{...input,years:1,downPct:3.5,appreciationPct:-15}} onYears={vi.fn()} onFlat={vi.fn()} onPrice={vi.fn()} onDown={vi.fn()} onRate={vi.fn()} onUpkeep={vi.fn()} />);
  expect(screen.getByText("Cash needed to sell")).toBeTruthy();
  expect(screen.queryByText("Cash back if sold")).toBeNull();
});
