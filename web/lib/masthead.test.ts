import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Masthead } from "@/components/Masthead";

vi.mock("@/components/PlaceSearch", () => ({ PlaceSearch: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/SiteStatus", () => ({ SiteStatus: () => null }));
vi.mock("@/components/LicenceLine", () => ({ LicenceLine: () => null }));
describe("the bar's destinations", () => {
  // The Tools menu left the bar on 2026-11-03; the tools are linked from the footer.
  it("links the three destinations and no tool", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" } }));
    for (const href of ["/atlas", "/compare", "/stories"]) expect(html).toContain(`href="${href}"`);
    for (const href of ["/afford?county=all", "/guide", "/tax", "/help"]) expect(html).not.toContain(`href="${href}"`);
    expect(html).not.toContain("Tools");
  });
});
