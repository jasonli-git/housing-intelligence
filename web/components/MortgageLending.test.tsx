// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PacketLevel } from "@/lib/api";
import { MortgageLending } from "./MortgageLending";

afterEach(cleanup);

const level = (metric_id: string, value: number) =>
  ({ metric_id, value, period_end: "2025-12-31", match_method: "tract_homes" }) as PacketLevel;

describe("MortgageLending", () => {
  it("says what borrowers got, estimated for a town, and what a denial rate is not", () => {
    render(
      <MortgageLending
        name="Absecon"
        levels={[
          level("hmda_purchase_loans", 96),
          level("hmda_median_rate", 6.625),
          level("hmda_median_loan_amount", 305000),
          level("hmda_median_ltv", 95),
          level("hmda_denial_rate", 0.075),
        ]}
      />,
    );
    expect(screen.getByText(/lenders made about/)).toBeTruthy();
    expect(screen.getByText("6.63%")).toBeTruthy();
    expect(screen.getByText(/put about 5% down/)).toBeTruthy();
    expect(screen.getByText(/not a measure of who could qualify/)).toBeTruthy();
    expect(screen.getByText(/an estimate/)).toBeTruthy();
  });

  it("renders nothing without HMDA figures", () => {
    const { container } = render(<MortgageLending name="Walpack" levels={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
