// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { DecisionGuide } from "./DecisionGuide";

it("previews all three questions without claiming missing data before selection", () => {
  const html = renderToString(<DecisionGuide artifactUrl="http://localhost:8001" rate={{ value: 6.8, asOf: "Oct 2026" }} newest={{}} />);
  for (const id of ["guide-afford-heading", "guide-rent-heading", "guide-checks-heading"]) {
    expect(html.split(`id="${id}"`)).toHaveLength(2);
  }
  expect(html.match(/class="guide-preview"/g)).toHaveLength(3);
  expect(html).not.toContain("No home price is published");
  expect(html).not.toContain("guide-answer-body");
  expect(html).toContain('aria-label="In this guide"');
  const contents=html.match(/<nav class="guide-contents"[\s\S]*?<\/nav>/)?.[0] ?? "";
  expect(contents.match(/href="#guide-place-heading"/g)).toHaveLength(4);
  const checks=html.match(/<nav class="guide-check-index"[\s\S]*?<\/nav>/)?.[0] ?? "";
  expect(checks.match(/href="#guide-place-heading"/g)).toHaveLength(10);
  for(const label of ["Property tax", "Financing", "Home sales", "Flooding", "Drinking water", "Contaminated sites", "Radon", "Schools", "Commute", "Internet &amp; utilities"]) expect(checks).toContain(label);
});
