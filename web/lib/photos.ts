/**
 * Place photos (ARCHITECTURE #368): the New Jersey page and the 21 county pages, one
 * reviewed Wikimedia Commons photograph each. `photos.json` is the reviewed record —
 * credit, licence, the original's hash, the crop — and the only way a photo reaches a
 * page. Keyed by GEOID, not region id or address, so a renumbering or a renamed slug
 * cannot attach a photo to the wrong place.
 */

import manifest from "./photos.json";
import { artifactUrl } from "./api";
import { cropBox, derivativeWidths, type Crop } from "./photoCrop";

export type PlacePhoto = {
  geoid: string;
  place: string;
  caption: string;
  alt: string;
  credit: { artist: string; licence: string; licence_url: string; source: string; title: string };
  original: { url: string; sha256: string; width: number; height: number };
  crop: Crop;
  located_by: "geotag" | "title";
  reviewed: string;
};

/** The licences a photo may carry: free to reuse, adapt and share, any purpose. */
export const PHOTO_LICENCES = ["Public domain", "CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0"];

export const PHOTOS: PlacePhoto[] = manifest as PlacePhoto[];
const byGeoid = new Map(PHOTOS.map((photo) => [photo.geoid, photo]));

/** The reviewed photo for a state or county, or nothing: a page without one is complete as it is. */
export function photoFor(geoid: string): PlacePhoto | undefined {
  return byGeoid.get(geoid);
}

/** The derivatives the build writes for a photo, as `srcset` entries for one format. */
export function photoSources(photo: PlacePhoto, format: "avif" | "webp", base = artifactUrl) {
  const box = cropBox(photo.original.width, photo.original.height, photo.crop);
  const widths = derivativeWidths(box.width);
  return {
    srcSet: widths.map((w) => `${base}/photos/${photo.geoid}-${w}.${format} ${w}w`).join(", "),
    largest: `${base}/photos/${photo.geoid}-${widths[widths.length - 1]}.${format}`,
  };
}
