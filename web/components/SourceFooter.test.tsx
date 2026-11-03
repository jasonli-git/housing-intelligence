// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SourceFooter } from "./SourceFooter";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

const { sources } = vi.hoisted(() => ({ sources: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { sources }, artifactUrl: "https://data.example" }));
beforeEach(() => sources.mockResolvedValue([{
  source_id: "census_acs", name: "Synthetic source", publisher: "Synthetic publisher",
  license: "Synthetic terms", url: "https://example.com/source", homepage: "https://example.com/source",
  cadence: "Annual", releases: [], notices: ["Synthetic attribution retained verbatim."],
}]));
afterEach(cleanup);

it("links the pages about the data as one row of plain links", async () => {
  render(await SourceFooter());
  const about = screen.getByRole("navigation", { name: "About the data" });
  expect(within(about).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/sources", "/data", "/freshness", "/changes"]);
  expect(within(about).queryByText(/Visual stories/)).toBeNull();
});

it("preserves the complete code/data notice and every policy destination", async () => {
  render(await SourceFooter());
  const notice = screen.getByRole("region", { name: "Code and data terms" });
  expect(notice.querySelector(".site-foot-intro")?.textContent?.replace(/\s+/g, " ")).toBe(
    `The code is free software under the GNU Affero General Public License v3.0, and its source is public. The data is not ours to relicense, and this site cannot grant terms it was not given. Questions or corrections: ${CONTACT_EMAIL}.`,
  );
  expect(within(notice).getByRole("link", { name: "its source is public" }).getAttribute("href")).toBe(REPO_URL);
  expect(within(notice).getByRole("link", { name: /^Notice/ }).getAttribute("href")).toBe(`${REPO_URL}/blob/main/NOTICE`);
  expect(within(notice).getByRole("link", { name: CONTACT_EMAIL }).getAttribute("href")).toBe(`mailto:${CONTACT_EMAIL}`);
  expect(within(screen.getByRole("navigation", { name: "Site policies" })).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([`${REPO_URL}/blob/main/NOTICE`, "/terms", "/privacy", `${REPO_URL}/blob/main/LICENSE`]);
  expect(notice.children[1].className).toBe("site-foot-intro");
});

it("keeps the publisher notice and names every institution, with no disclosure", async () => {
  render(await SourceFooter());
  expect(within(screen.getByRole("group", { name: "Notices the sources require" })).getByText("Synthetic attribution retained verbatim.")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Sources" })).getByText("Synthetic publisher")).toBeTruthy();
  expect(document.querySelector(".foot details")).toBeNull();
});

it("does not invent attribution when source data is unavailable", async () => {
  sources.mockResolvedValue(null);
  expect(await SourceFooter()).toBeNull();
});
