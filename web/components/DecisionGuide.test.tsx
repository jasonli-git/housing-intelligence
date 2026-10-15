// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { DecisionGuide } from "./DecisionGuide";

it("asks for a place first and names the three answers without claiming missing data", () => {
  const html = renderToString(<DecisionGuide artifactUrl="http://localhost:8001" rate={{ value: 6.8, asOf: "Oct 2026" }} newest={{}} />);
  expect(html).toContain("Pick a place");
  expect(html).toContain("Start here");
  expect(html).toContain('data-ready="false"');
  expect(html).toContain("can you afford it, should you rent or buy, and what to check before an offer");
  expect(html).not.toContain("No home price is published");
  expect(html).not.toContain('class="guide-answers"');
  expect(html).not.toContain("guide-slide");
  expect(html).toContain('href="/help"');
});
