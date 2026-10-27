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
  expect(screen.getByRole("searchbox")).toBeTruthy();
});
it("filters destinations while preserving direct links", () => {
  render(<CountyCabinet counties={counties} />);
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"somerset"}});
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link",{name:"Explore Somerset County"}).getAttribute("href")).toBe("/nj/somerset-county");
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"no such county"}});
  expect(screen.getByText(/No matching places/)).toBeTruthy();
});
it("renders no empty navigation", () => {
  const { container } = render(<CountyCabinet counties={[]} />);
  expect(container.innerHTML).toBe("");
});
it("searches beyond the collapsed preview and restores the directory when cleared", () => {
  const many = Array.from({length:9},(_,i)=>({id:i+1,name:`County ${i+1}`}));
  render(<CountyCabinet counties={many} />);
  expect(screen.getByRole("button",{name:"Show all 9 places"}).getAttribute("aria-expanded")).toBe("false");
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"County 9"}});
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link",{name:"Explore County 9"}).closest("li")?.className).toBe("");
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:""}});
  fireEvent.click(screen.getByRole("button",{name:"Show all 9 places"}));
  expect(screen.getByRole("button",{name:"Show fewer places"}).getAttribute("aria-expanded")).toBe("true");
});
