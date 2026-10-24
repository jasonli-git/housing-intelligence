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

it("keeps the original hero wording and full accessible label", () => {
  render(<PlaceSearch variant="hero" />);
  expect(screen.getByRole("combobox", { name: "Search by state, town, county or ZIP code" }).getAttribute("placeholder")).toBe("State, town, county or ZIP code");
});
