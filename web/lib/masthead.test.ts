import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Masthead } from "@/components/Masthead";

vi.mock("@/components/PlaceSearch", () => ({ PlaceSearch: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/SiteStatus", () => ({ SiteStatus: () => null }));
vi.mock("@/components/LicenceLine", () => ({ LicenceLine: () => null }));
describe("the bar's destinations", () => {
  // The Tools button left the bar on 2026-11-03. On 2026-11-10 the owner approved one Menu,
  // at every width, that lists every destination, with no separate Tools button (#492).
  it("links the three destinations and, in its one Menu, the four tools (the budget is on the map, #496)", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" } }));
    for (const href of ["/atlas", "/compare", "/stories", "/guide", "/tax", "/affordable-housing", "/help"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain('href="/afford"');
    expect(html).not.toMatch(/<summary>[^]*?Tools[^]*?<\/summary>/);
    expect(html.match(/<summary/g)).toHaveLength(1);
  });
  it("keeps the same bar on a tool page and gives its name a heading below it", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" }, title: "Compare places" }));
    expect(html).toContain('<header class="tool-head"><h1>Compare places</h1></header>');
    expect(html).toContain("bar-desktop-tools");
  });
});
