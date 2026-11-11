// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { DecisionGuide } from "./DecisionGuide";

it("asks for a place first, then leads with the checks, without claiming missing data", () => {
  const html = renderToString(<DecisionGuide artifactUrl="http://localhost:8001" rate={{ value: 6.8, asOf: "Oct 2026" }} newest={{}} />);
  expect(html).toContain("Pick a place");
  expect(html).toContain("Start here");
  expect(html).toContain('data-ready="false"');
  // The checks lead, ahead of the reader's own numbers (#494).
  expect(html).toContain("what to check before buying there");
  expect(html.indexOf("What to check")).toBeLessThan(html.indexOf("Your own numbers"));
  expect(html.indexOf("Your own numbers")).toBeLessThan(html.indexOf("Household income a year"));
  expect(html).not.toContain("No home price is published");
  expect(html).not.toContain('class="guide-answers"');
  expect(html).not.toContain("guide-slide");
  expect(html).toContain('href="/help"');
});
