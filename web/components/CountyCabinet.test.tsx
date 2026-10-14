// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CountyCabinet } from "./CountyCabinet";

afterEach(cleanup);
const counties = [{ id:5, name:"Atlantic County" }, { id:12, name:"Somerset County" }];
it("links each county directly without a preview panel", () => {
  render(<CountyCabinet counties={counties} />);
  expect(screen.getByRole("link", { name:"Explore Somerset County" }).getAttribute("href")).toBe("/nj/somerset-county");
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.queryByText("Housing costs, the local picture and the figures behind it.")).toBeNull();
  expect(screen.getByRole("button", {name:"Scroll counties right"})).toBeTruthy();
});
it("supports directional keyboard browsing without navigating", () => {
  render(<CountyCabinet counties={counties} />);
  const first=screen.getByRole("link",{name:"Explore Atlantic County"});
  const last=screen.getByRole("link",{name:"Explore Somerset County"});
  last.scrollIntoView=()=>{}; first.scrollIntoView=()=>{};
  first.focus(); fireEvent.keyDown(first,{key:"End"}); expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last,{key:"Home"}); expect(document.activeElement).toBe(first);
});
it("renders no empty navigation", () => {
  const { container } = render(<CountyCabinet counties={[]} />);
  expect(container.innerHTML).toBe("");
});
