import { fit, scene, view, rotate, screen, type Outline } from "./globe";

export const STATE_DESTINATIONS: Readonly<Record<string, string>> = {
  NJ: "/states/new-jersey",
};

export type CoverageViewport = { scale: number; x: number; y: number };
export const COVERAGE_HOME: CoverageViewport = { scale: 1, x: 0, y: 0 };

/** Keep the original frame reachable, with room to center coastal states. */
export function boundCoverage(viewport: CoverageViewport): CoverageViewport {
  const scale = Math.max(1, Math.min(5, viewport.scale));
  if (scale === 1) return { ...COVERAGE_HOME };
  return { scale, x: Math.max(900 * (1 - scale) - 450, Math.min(450, viewport.x)), y: Math.max(480 * (1 - scale) - 240, Math.min(240, viewport.y)) };
}

export function zoomCoverage(current: CoverageViewport, factor: number, locator: readonly number[]): CoverageViewport {
  const scale = Math.max(1, Math.min(5, current.scale * factor));
  // The first step favors the only available destination; subsequent steps retain
  // the reader's current center after panning. Zooming out to one restores the US.
  const x = current.scale === 1 ? locator[0] : (450 - current.x) / current.scale;
  const y = current.scale === 1 ? locator[1] : (240 - current.y) / current.scale;
  return boundCoverage({ scale, x: 450 - scale * x, y: 240 - scale * y });
}

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
