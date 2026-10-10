import { describe, expect, it } from "vitest";

import { cropBox, derivativeWidths, PHOTO_ASPECT } from "@/lib/photoCrop";
import { PHOTO_LICENCES, PHOTOS, photoFor, photoSources } from "@/lib/photos";

// New Jersey and its 21 counties: FIPS 34, then 001–041, odd numbers only.
const NJ_PAGES = new Set(["34", ...Array.from({ length: 21 }, (_, i) => `34${String(2 * i + 1).padStart(3, "0")}`)]);

describe("the reviewed photo manifest", () => {
  it("covers the state page and all 21 counties, once each, and nothing else", () => {
    expect(PHOTOS.map((p) => p.geoid).sort()).toEqual([...NJ_PAGES].sort());
  });

  it("carries only licences free to reuse and adapt, with a credit, source and caption", () => {
    for (const p of PHOTOS) {
      expect(PHOTO_LICENCES).toContain(p.credit.licence);
      expect(p.credit.artist.trim()).not.toBe("");
      expect(p.credit.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.credit.licence_url).toMatch(/^https:\/\//);
      expect(p.caption.trim()).not.toBe("");
      expect(p.alt.length).toBeGreaterThan(20);
      expect(p.original.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(["geotag", "title"]).toContain(p.located_by);
    }
  });

  it("crops every photo inside its original, to the one shape", () => {
    for (const p of PHOTOS) {
      const box = cropBox(p.original.width, p.original.height, p.crop);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(p.original.width);
      expect(box.top + box.height).toBeLessThanOrEqual(p.original.height);
      expect(Math.abs(box.width / box.height - PHOTO_ASPECT)).toBeLessThan(0.01);
      expect(box.width).toBeGreaterThanOrEqual(640);
    }
  });
});

describe("cropBox", () => {
  it("takes the largest 3:2 window, centred, from a wide or a tall frame", () => {
    expect(cropBox(3000, 1000, { cx: 0.5, cy: 0.5, scale: 1 })).toEqual({ left: 750, top: 0, width: 1500, height: 1000 });
    expect(cropBox(1500, 1500, { cx: 0.5, cy: 0.5, scale: 1 })).toEqual({ left: 0, top: 250, width: 1500, height: 1000 });
  });

  it("slides a window back inside the frame rather than cutting it off", () => {
    expect(cropBox(3000, 1000, { cx: 0, cy: 0.5, scale: 1 }).left).toBe(0);
    expect(cropBox(3000, 1000, { cx: 1, cy: 0.5, scale: 1 }).left).toBe(1500);
  });

  it("never writes a derivative wider than the crop", () => {
    expect(derivativeWidths(3000)).toEqual([640, 1280]);
    expect(derivativeWidths(900)).toEqual([640]);
    expect(derivativeWidths(500)).toEqual([500]);
  });
});

describe("photoFor", () => {
  it("has nothing for a town or a ZIP code", () => {
    expect(photoFor("3402174000")).toBeUndefined();
    expect(photoFor("08540")).toBeUndefined();
  });

  it("points at the derivatives the build writes, on the artifact host", () => {
    const sources = photoSources(photoFor("34021")!, "webp", "https://data.example");
    expect(sources.srcSet).toBe("https://data.example/photos/34021-640.webp 640w, https://data.example/photos/34021-1280.webp 1280w");
    expect(sources.largest).toBe("https://data.example/photos/34021-1280.webp");
  });
});
