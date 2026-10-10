/**
 * The crop each place photo is cut to (ARCHITECTURE #368): one shape everywhere, 3:2,
 * so a header never reflows photo by photo. Kept free of imports so the build script
 * (`scripts/make-photos.mjs`, run by Node directly) and the page share the one rule.
 */

export const PHOTO_ASPECT = 3 / 2;
/** Derivative widths written by the build; the page's `srcset` lists the same. */
export const PHOTO_WIDTHS = [640, 1280] as const;

export type Crop = { cx: number; cy: number; scale: number };

/**
 * The 3:2 window of a `width` × `height` original: the largest one that fits, shrunk by
 * `scale`, centred on (`cx`, `cy`) as fractions of the frame, and slid back inside the
 * frame rather than cut off at an edge. `scale` < 1 is how a crop leaves something out
 * (the boat names in Camden's, the parked cars in Essex's).
 */
export function cropBox(width: number, height: number, crop: Crop) {
  const fit = width / height > PHOTO_ASPECT
    ? { w: height * PHOTO_ASPECT, h: height }
    : { w: width, h: width / PHOTO_ASPECT };
  const w = Math.round(fit.w * crop.scale);
  const h = Math.round(w / PHOTO_ASPECT);
  const clamp = (v: number, max: number) => Math.min(Math.max(Math.round(v), 0), max);
  return {
    left: clamp(crop.cx * width - w / 2, width - w),
    top: clamp(crop.cy * height - h / 2, height - h),
    width: w,
    height: h,
  };
}

/** The widths actually written for a crop: never wider than the crop itself. */
export function derivativeWidths(cropWidth: number): number[] {
  const fitting = PHOTO_WIDTHS.filter((w) => w <= cropWidth);
  return fitting.length ? [...fitting] : [cropWidth];
}
