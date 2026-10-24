// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlaceSearch } from "./PlaceSearch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

it("keeps the shared header search wording", () => {
  render(<PlaceSearch />);
  expect(screen.getByRole("combobox", { name: "Search by state, town, county or ZIP code" }).getAttribute("placeholder")).toBe("Town, county or ZIP");
});

it("keeps the default hero wording for the 404 and other callers", () => {
  render(<PlaceSearch variant="hero" />);
  expect(screen.getByRole("combobox").getAttribute("placeholder")).toBe("State, town, county or ZIP code");
});

it("allows concise homepage wording without shortening the accessible label", () => {
  render(<PlaceSearch variant="hero" placeholder="Find a place or ZIP code" />);
  expect(screen.getByRole("combobox", { name: "Search by state, town, county or ZIP code" }).getAttribute("placeholder")).toBe("Find a place or ZIP code");
});
