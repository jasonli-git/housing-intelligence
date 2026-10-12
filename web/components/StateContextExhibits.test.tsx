// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { PacketLevel } from "@/lib/api";
import { StateContextExhibits } from "./StateContextExhibits";
afterEach(cleanup);
it("lets pages place topic exhibits separately without duplicating others", () => {
 const {container}=render(<StateContextExhibits topics={["lending"]} levels={[]} destinations={null} community={null} />);
 expect(container.querySelectorAll(".learning-exhibit")).toHaveLength(1);
 expect(container.querySelector('[data-exhibit="Buyer financing"]')).toBeTruthy();
 expect(container.querySelector('[data-exhibit="Work & transit"]')).toBeNull();
});
it("does not substitute county broadband for a town or ZIP", () => {
  const { container } = render(<StateContextExhibits name="Princeton" level="municipality" levels={[]} destinations={null} community={null} />);
  expect(container.querySelector('[data-exhibit-style="network"]')).toBeNull();
});
it("keeps unavailable sources explicit instead of inventing figures", () => {
  render(<StateContextExhibits levels={[]} destinations={null} community={null} />);
  expect(screen.getByText("Mortgage records are unavailable in this snapshot.")).toBeTruthy();
  expect(screen.getByText("Work destinations are unavailable in this snapshot.")).toBeTruthy();
  expect(screen.getByRole("link", { name:"Check the FCC map by address" })).toBeTruthy();
});
it("exposes reported loan and commute figures with their limits and full records", () => {
  const row = (metric_id:string, value:number) => ({ metric_id, value, period_end:"2025-12-31", match_method:"fips" }) as PacketLevel;
  render(<StateContextExhibits levels={[row("hmda_purchase_loans",100),row("hmda_median_rate",6.5),row("acs_mean_commute_minutes",30)]} destinations={null} community={null} />);
  expect(screen.getAllByText("6.50%")[0].closest("dl")?.className).toBe("state-exhibit-readouts");
  expect(screen.getByText("30 min")).toBeTruthy();
  expect(screen.getByText(/not current offers or cash purchases/)).toBeTruthy();
  expect(screen.getByText("Loan programmes, applications & limits")).toBeTruthy();
});
