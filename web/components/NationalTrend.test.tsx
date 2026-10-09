// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NationalTrend } from "./NationalTrend";

it("server-renders precise point titles and hydrates without warnings or recovery", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const recover = vi.fn();
  const element = <NationalTrend points={[{ date: "2026-06-01", value: 6 }, { date: "2026-07-01", value: 7 }]}
    label="Mortgage rate" metricId="mortgage_rate_30y" frequency="Monthly" />;
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root | undefined;
  try {
    container.innerHTML = renderToString(element);
    expect([...container.querySelectorAll("circle title")].map(n => n.textContent)).toEqual(["2026-06-01: 6.00%", "2026-07-01: 7.00%"]);
    await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recover }); });
    expect(recover).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("independently scaled");
  } finally {
    if (root) await act(async () => root!.unmount());
    container.remove();
    errors.mockRestore();
  }
});

it("does not invent a chart when comparable history is absent", () => {
  const html = renderToString(<NationalTrend points={[]} label="Prices" metricId="fhfa_hpi_us_monthly" frequency="Monthly" />);
  expect(html).toContain("Not enough comparable history to plot.");
  expect(html).not.toContain("<svg");
});
