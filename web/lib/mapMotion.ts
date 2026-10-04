import type { Camera } from "./globe";

/** Buttons respond immediately; geographic jumps retain a gentler arrival. */
export function flightTiming(from: Camera, to: Camera, quick = false) {
  const turns = Math.hypot(to.lon - from.lon, to.lat - from.lat) / 40;
  const zooms = Math.abs(Math.log(to.scale / from.scale)) / Math.log(8);
  return {
    duration: quick ? 160 : Math.min(1150, 420 + Math.max(turns, zooms) * 520),
    ease(progress: number) {
      const t = Math.max(0, Math.min(1, progress));
      return quick ? 1 - (1 - t) ** 3 : t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    },
  };
}
