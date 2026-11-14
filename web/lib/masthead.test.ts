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
  it("links the three destinations and, in its one Menu, the tax lookup; the shopper tools are retired (#507)", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" } }));
    for (const href of ["/atlas", "/compare", "/stories", "/tax"]) expect(html).toContain(`href="${href}"`);
    for (const href of ["/affordable-housing", "/help", "/calculator"]) expect(html).not.toContain(`href="${href}"`);
    // A town's briefing is its own page (#520), so the Menu no longer lists one.
    expect(html).not.toContain('href="/guide"');
    expect(html).not.toContain('href="/afford"');
    expect(html).not.toMatch(/<summary>[^]*?Tools[^]*?<\/summary>/);
    expect(html.match(/<summary/g)).toHaveLength(1);
  });
  it("is the same bar on a tool page, with no heading of its own: the page's h1 is inside main", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" }, compareActive: true }));
    expect(html).not.toContain("<h1");
    expect(html).toContain("bar-desktop-tools");
  });
});
