import { fit, scene, view, rotate, screen, type Outline } from "./globe";

export const STATE_DESTINATIONS: Readonly<Record<string, string>> = {
  NJ: "/states/new-jersey",
};

export type CoverageViewport = { scale: number; x: number; y: number };
export const COVERAGE_HOME: CoverageViewport = { scale: 1, x: 0, y: 0 };

/** Census regions; these frame geography, never imply published data coverage.
 * AK/HI belong to West but remain outside this contiguous-US map.
 */
export const COVERAGE_REGIONS = {
  Northeast: ["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"],
  Midwest: ["IN", "IL", "MI", "OH", "WI", "IA", "KS", "MN", "MO", "NE", "ND", "SD"],
  South: ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV", "AL", "KY", "MS", "TN", "AR", "LA", "OK", "TX"],
  West: ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "AK", "CA", "HI", "OR", "WA"],
} as const;
export type CoverageRegion = keyof typeof COVERAGE_REGIONS;

export function regionViewport(outlines: Outline[], region: CoverageRegion): CoverageViewport | null {
  const drawing = coverageScene(outlines);
  if (!drawing) return null;
  const members: readonly string[] = COVERAGE_REGIONS[region];
  const points = outlines.filter((o) => members.includes(String(o.id)) && !["AK", "HI"].includes(String(o.id)))
    .flatMap((o) => o.rings.flatMap((ring) => {
      const projected: (readonly number[])[] = [];
      for (let i = 0; i < ring.length; i += 2) {
        const point = rotate(drawing.perspective.camera, [ring[i], ring[i + 1]]);
        if (point[2] > 0) projected.push(screen(drawing.perspective, point, 0));
      }
      return projected;
    }));
  if (!points.length) return null;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const scale = Math.min(5, Math.max(1, Math.min(760 / Math.max(1, right - left), 350 / Math.max(1, bottom - top))));
  return boundCoverage({ scale, x: 450 - scale * (left + right) / 2, y: 240 - scale * (top + bottom) / 2 });
}

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
