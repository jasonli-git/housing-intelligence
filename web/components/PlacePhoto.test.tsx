import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlacePhoto } from "@/components/PlacePhoto";

describe("PlacePhoto", () => {
  it("credits the photographer, links the licence and says it was cropped", () => {
    const html = renderToStaticMarkup(<PlacePhoto geoid="34021" />);
    expect(html).toContain("Mercer Lake, Mercer County Park, West Windsor");
    expect(html).toContain("Ryan Hodnett");
    expect(html).toContain('rel="license noopener"');
    expect(html).toContain("CC BY-SA 4.0");
    expect(html).toContain(", cropped");
    expect(html).toMatch(/alt="Mercer Lake[^"]+"/);
    expect(html).toContain('type="image/avif"');
  });

  it("says public domain without a licence link or a 'cropped' it does not owe", () => {
    const html = renderToStaticMarkup(<PlacePhoto geoid="34013" />);
    expect(html).toContain("public domain");
    expect(html).not.toContain(", cropped");
  });

  it("is left out of print, and renders nothing for a place without a photo", () => {
    expect(renderToStaticMarkup(<PlacePhoto geoid="34021" />)).toContain("print-hide");
    expect(renderToStaticMarkup(<PlacePhoto geoid="3402174000" />)).toBe("");
  });
});
