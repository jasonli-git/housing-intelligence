import { fit, scene, view, rotate, screen, type Outline } from "./globe";

export const STATE_DESTINATIONS: Readonly<Record<string, string>> = {
  NJ: "/states/new-jersey",
};

/** A coverage locator, not a ranking. Off-continent outlines do not shrink the frame. */
export function coverageScene(outlines: Outline[]) {
  const contiguous = outlines.filter((outline) => !["AK", "HI", "PR"].includes(String(outline.id)));
  if (!contiguous.length) return null;
  const camera = fit(contiguous, { width: 900, height: 480, padding: 0.84 });
  const perspective = view(camera);
  return {
    perspective,
    states: scene(perspective, contiguous, (id) => STATE_DESTINATIONS[String(id)] ? 6 : 0),
    // A locator within NJ, not a measurement or a derived metric centroid.
    locator: screen(perspective, rotate(camera, [-74.5, 40]), 6),
  };
}
