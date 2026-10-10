// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PacketLevel, WorkDestinations } from "@/lib/api";
import { GettingAround } from "./GettingAround";

afterEach(cleanup);

const level = (metric_id: string, value: number) =>
  ({ metric_id, value, period_end: "2023-12-31" }) as PacketLevel;

const levels = [
  level("lodes_resident_jobs", 34044),
  level("lodes_work_same_town_share", 0.083),
  level("lodes_work_home_county_share", 0.175),
  level("lodes_work_other_nj_share", 0.275),
  level("lodes_work_nyc_share", 0.507),
  level("lodes_work_pennsylvania_share", 0.005),
  level("lodes_work_other_state_share", 0.038),
  level("transit_rail_homes_share", 0.745),
  level("transit_bus_homes_share", 0.992),
  level("acs_mean_commute_minutes", 33.4),
  level("acs_commute_transit_share", 0.52),
];

const destinations: WorkDestinations = {
  region_id: 1,
  year: 2023,
  total_jobs: 34044,
  destinations: [
    { rank: 1, name: "New York City", region_id: null, jobs: 17255, share: 0.507 },
    { rank: 2, name: "Hoboken", region_id: 344, jobs: 2830, share: 0.083 },
  ],
};

describe("GettingAround", () => {
  it("says where jobs are, links New Jersey destinations, and calls nearness nearness", () => {
    render(<GettingAround name="Hoboken" level="municipality" levels={levels} destinations={destinations} />);
    expect(screen.getByRole("heading", { name: "How do people here get around?" })).toBeTruthy();
    expect(screen.getByText(/51% in New York City/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Hoboken" }).getAttribute("href")).toBe("/regions/hoboken");
    expect(screen.getByRole("rowheader", { name: "New York City" }).querySelector("a")).toBeNull();
    expect(screen.getByText(/not how often anything calls there/)).toBeTruthy();
    expect(screen.getByText(/about 33 minutes/)).toBeTruthy();
  });

  it("renders nothing without any of its figures", () => {
    const { container } = render(<GettingAround name="Nowhere" level="zip" levels={[]} destinations={null} />);
    expect(container.innerHTML).toBe("");
  });
});
