// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LearningExhibit } from "./LearningExhibit";

afterEach(cleanup);
it("gives each topic its own decorative language without changing its content", () => {
  const kinds = ["Home sales", "Prices & paychecks", "Against its own history", "New homes", "Arrivals & departures"];
  const { container } = render(<>{kinds.map(kind => <LearningExhibit key={kind} kind={kind}><p>{kind} figures</p></LearningExhibit>)}</>);
  expect(Array.from(container.querySelectorAll("[data-exhibit-style]"), el => el.getAttribute("data-exhibit-style"))).toEqual(["sales", "paychecks", "history", "building", "migration"]);
  expect(new Set(Array.from(container.querySelectorAll("path"), el => el.getAttribute("d"))).size).toBe(5);
  expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5);
  expect(container.querySelectorAll(".exhibit-content p")).toHaveLength(5);
});
