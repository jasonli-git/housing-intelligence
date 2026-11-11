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
  it("links the three destinations and, in its one Menu, the four tools", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" } }));
    for (const href of ["/atlas", "/compare", "/stories", "/afford", "/guide", "/tax", "/help"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("Tools");
    expect(html.match(/<summary/g)).toHaveLength(1);
  });
  it("carries a tool page's name as the page heading, in place of the inline links", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" }, title: "Compare places" }));
    expect(html).toContain('<h1 class="bar-title">Compare places</h1>');
    expect(html).not.toContain("bar-desktop-tools");
  });
});
