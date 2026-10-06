// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { sample } from "@/lib/similar.fixture";
import { SimilarPlaces } from "./SimilarPlaces";

afterEach(cleanup);

describe("SimilarPlaces", () => {
  it("names its measures and sets the town beside linked matches", () => {
    render(<SimilarPlaces name="Cherry Hill" data={sample} />);
    expect(screen.getByText(/The town most like Cherry Hill/)).toBeTruthy();
    expect(screen.getByText(/means only acs_share_detached and acs_homeownership_rate/)).toBeTruthy();
    expect(screen.getByText(/January 2024 to June 2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Audubon" }).getAttribute("href")).toBe("/regions/610");
    expect(screen.getByText("$375,000")).toBeTruthy();
  });

  it("says so when no town is near enough, and shows no table", () => {
    render(<SimilarPlaces name="Hoboken" data={{ ...sample, matches: [] }} />);
    expect(screen.getByText(/No New Jersey town is close enough to Hoboken/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders nothing where the town cannot be compared", () => {
    const { container } = render(<SimilarPlaces name="Walpack" data={null} />);
    expect(container.innerHTML).toBe("");
  });
});
