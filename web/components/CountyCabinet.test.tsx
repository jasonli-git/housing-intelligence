// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CountyCabinet } from "./CountyCabinet";

afterEach(cleanup);
const counties = [{ id:5, name:"Atlantic County" }, { id:12, name:"Somerset County" }];
it("previews counties without navigating and provides an explicit destination link", () => {
  render(<CountyCabinet counties={counties} />);
  fireEvent.click(screen.getByRole("button", { name:/Somerset/ }));
  expect(screen.getByRole("heading", { name:"Somerset County" })).toBeTruthy();
  expect(screen.getByRole("link", { name:/Explore county/ }).getAttribute("href")).toBe("/nj/somerset-county");
});
it("offers a direct directory and preserves selection on return", () => {
  render(<CountyCabinet counties={counties} />);
  fireEvent.click(screen.getByRole("button", { name:/Somerset/ }));
  fireEvent.click(screen.getByRole("button", { name:"All counties" }));
  expect(screen.getByRole("navigation", { name:"All counties" }).hidden).toBe(false);
  expect(screen.getByRole("link", { name:/Atlantic/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name:"Folder view" }));
  expect(screen.getByRole("heading", { name:"Somerset County" })).toBeTruthy();
});
it("renders no empty cabinet", () => {
  const { container } = render(<CountyCabinet counties={[]} />);
  expect(container.innerHTML).toBe("");
});
