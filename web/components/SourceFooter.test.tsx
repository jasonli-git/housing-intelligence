// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SourceFooter } from "./SourceFooter";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

const { sources } = vi.hoisted(() => ({ sources: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { sources } }));
beforeEach(() => sources.mockResolvedValue([{
  source_id: "census_acs", name: "Synthetic source", publisher: "Synthetic publisher",
  license: "Synthetic terms", url: "https://example.com/source", homepage: "https://example.com/source",
  cadence: "Annual", releases: [], notices: ["Synthetic attribution retained verbatim."],
}]));
afterEach(cleanup);

it("keeps source history focused on freshness and revisions", async () => {
  render(await SourceFooter());
  const history = screen.getByRole("navigation", { name: "Source history" });
  expect(within(history).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/freshness", "/changes"]);
  expect(within(history).queryByText(/Visual stories/)).toBeNull();
});

it("preserves the complete code/data notice and every policy destination", async () => {
  render(await SourceFooter());
  const notice = screen.getByRole("region", { name: "Code and data terms" });
  expect(notice.querySelector(".foot-intro")?.textContent?.replace(/\s+/g, " ")).toBe(
    `The code is free software under the GNU Affero General Public License v3.0, and its source is public. The data is not ours to relicense, and this site cannot grant terms it was not given. Questions or corrections: ${CONTACT_EMAIL}.`,
  );
  expect(within(notice).getByRole("link", { name: "its source is public" }).getAttribute("href")).toBe(REPO_URL);
  expect(within(notice).getByRole("link", { name: "Notice" }).getAttribute("href")).toBe(`${REPO_URL}/blob/main/NOTICE`);
  expect(within(notice).getByRole("link", { name: CONTACT_EMAIL }).getAttribute("href")).toBe(`mailto:${CONTACT_EMAIL}`);
  expect(within(screen.getByRole("navigation", { name: "Site policies" })).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/terms", "/privacy", `${REPO_URL}/blob/main/LICENSE`]);
  expect(notice.children[1].className).toBe("foot-intro");
});

it("leaves the visible publisher notice and source disclosure intact", async () => {
  render(await SourceFooter());
  expect(within(screen.getByRole("group", { name: "Notices the sources require" })).getByText("Synthetic attribution retained verbatim.")).toBeTruthy();
  expect(screen.getByText("Synthetic source").getAttribute("href")).toBe("https://example.com/source");
  expect(document.querySelector("details.footer-provenance > summary .foot-title-block")?.textContent).toContain("Data provenance");
});

it("does not invent attribution when source data is unavailable", async () => {
  sources.mockResolvedValue(null);
  expect(await SourceFooter()).toBeNull();
});
