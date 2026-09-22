"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { rampFor } from "@/lib/groups";
import {
  type Camera,
  type Outline,
  at,
  fit,
  prism,
  scene,
  view,
  warm,
} from "@/lib/globe";
import { type MapFile, readingsFor } from "@/lib/mapdata";
import { paint as paintInto, reserve } from "@/lib/paint";
import type { MapLayers } from "@/components/useMapFile";
import { WORLD_LAND } from "@/lib/worldLand";
import {
  classIndex,
  quantileBreaks,
  sortedValues,
  straddlesZero,
} from "@/lib/scale";

/**
 * New Jersey on a globe, drawn by hand.
 *
 * No map library: the outlines are ours, the projection is `lib/globe.ts`, and the
 * result is SVG, so it prints, it is in the accessibility tree, and it costs no
 * dependency. ARCHITECTURE #39 rejected MapLibre for reasons that no longer apply — a
 * GeoJSON source needs no tile server and no key — and was kept for reasons that do:
 * 300KB of JavaScript, and a canvas a screen reader sees nothing in.
 *
 * The reader pans and zooms across the whole country. Only New Jersey has figures, so
 * every other state is drawn as ground and nothing else; the level of detail follows the
 * zoom, from states to counties to municipalities.
 *
 * One channel, not two. Color carries the measure across every region; height was tried
 * across the map and taken out again, because reading a magnitude off a block's height
 * while reading a ratio off its color asks a reader to hold two encodings at once, and
 * the blocks hide each other. What is left of height is the probe: the one region under
 * the crosshair, or pointed at in the ranking, rises off the map in proportion to its
 * own figure. Sweeping the crosshair then feels like running a hand over the surface,
 * and nothing is ever hidden behind anything.
 */

/** Where the reader lands, and where the "United States" button goes back to. */
const NATION_PADDING = 0.86;

/**
 * States the "United States" framing is measured without, though it still draws them.
 *
 * Hawaii to Puerto Rico is 95 degrees of longitude against the contiguous states' 58,
 * and framing on all of it halves the scale: the lower 48 come out at 279 pixels per
 * sphere radius rather than 584, to keep three outlines in the corners. They are a pan
 * away, and the crosshair reads them like any other ground. A paper atlas insets them;
 * a globe cannot.
 */
const OFF_THE_CONTINENT: ReadonlySet<string> = new Set(["AK", "HI", "PR"]);

/** The tallest the probe rises, as a share of the frame, with the whole state in view. */
const MAX_LIFT = 0.13;

/**
 * How far past the visible window the map is drawn, in frame units.
 *
 * A pan slides the already-painted layer under a stage that clips it, rather than
 * projecting 41,609 points again; this margin is the strip that has been painted before
 * it is needed, so the reader never sees the empty edge the slide is dragging in. The
 * camera is therefore a little larger than the window in every direction, and the middle
 * of the camera is still the middle of the window — which is where the crosshair is.
 *
 * Big enough to carry a fast flick for a few frames, small enough that the extra ground
 * is a fifth of the picture rather than half of it.
 */
const PAD = 110;

/** The camera a pan of `dx, dy` frame units arrives at. Pure, so the slide and its
 * commit cannot disagree about where the map ended up. */
function shifted(cam: Camera, dx: number, dy: number): Camera {
  const cosLat = Math.max(Math.cos((cam.lat * Math.PI) / 180), 0.2);
  const lon = cam.lon - ((dx / cam.scale) * 180) / Math.PI / cosLat;
  const lat = cam.lat + ((dy / cam.scale) * 180) / Math.PI;
  // Past the poles the rotation stops being a pan and starts being a tumble.
  return { ...cam, lon, lat: Math.max(-80, Math.min(80, lat)) };
}

/** A camera framing these outlines in the visible window, drawn PAD past it on each side. */
function framedOn(
  outlines: Outline[],
  box: { width: number; height: number; padding?: number },
): Camera {
  // The scale is fitted to the window, not to the padded canvas, or the map would sit
  // back from the frame by the margin it draws into.
  return { ...fit(outlines, box), width: box.width + PAD * 2, height: box.height + PAD * 2 };
}

const DIVERGING = [
  "var(--div-neg-2)",
  "var(--div-neg-1)",
  "var(--div-mid)",
  "var(--div-pos-1)",
  "var(--div-pos-2)",
];

/** What the crosshair can land on. `state` is the backdrop, which carries no figures. */
export type Level = "state" | "county" | "municipality";

/** The two levels New Jersey itself is drawn at. The state layer is context. */
export type DetailLevel = Exclude<Level, "state">;

export type Focus = {
  id: number | string;
  name: string;
  level: Level;
  /** The height measure's reading here, or null where the region has none. */
  value: number | null;
};

type Props = {
  /** The NJ landing experiment uses crisp boundaries instead of depth-of-field blur. */
  appearance?: "classic" | "atlas";
  width: number;
  height: number;
  /** `map.json` and its unpacked outlines, owned by the explorer (`useMapFile`). */
  file: MapFile | null;
  layers: MapLayers | null;
  failed: boolean;
  /** The measure the map draws. A key of `map.json`'s tables. */
  metric: string;
  /**
   * The change window the reader has chosen, which is what the map colors by. Named
   * `windowKey`, not `window`: the plain name shadows the global one the easing needs.
   */
  windowKey: string;
  /** What the measure is called, and how the window reads: "over five years". */
  metricLabel: string;
  windowPhrase: string;
  /** Formatters for the two things a reading can be. */
  format: (value: number) => string;
  formatChange: (value: number) => string;
  /** The region the page wants outlined — the crosshair's, or a row pointed at. */
  active?: number | null;
  /**
   * Whether to drop every other region to a neutral while `active` is drawn in full.
   *
   * Only for a deliberate choice, which is a row pointed at in the ranking. The
   * crosshair rests on something the whole time the map is open, so muting on it would
   * mean a map that is never a choropleth (ROADMAP).
   */
  mute?: boolean;
  /** Raised when the crosshair moves or the zoom changes the level being drawn. */
  onView?: (state: { level: DetailLevel; focus: Focus | null }) => void;
  /**
   * A fill per region, in place of the ramp. What `/afford` needs: within reach, beyond
   * reach, and nothing between — a quantile ramp there would give a town a few dollars
   * over the line the same color as one a few dollars under it (#144). `null` draws the
   * region as ground, which is already what "no figure" looks like.
   */
  paint?: (id: number | string) => string | null;
  /** A legend of the caller's own, where `paint` has made the ramp's meaningless. */
  legend?: ReactNode;
  /** Hold the map at one level instead of letting the zoom choose it. */
  pin?: DetailLevel;
  /**
   * A region to carry the camera to. The map flies there whenever this changes to a new
   * id, and ignores it otherwise — so a page can answer a reader's search by moving the
   * map, without the map moving again every time the page re-renders around it.
   */
  frameOn?: number | string | null;
  /** What the map is showing, for the label a screen reader reads. */
  describe?: string;
};

/**
 * How finely New Jersey is drawn at a given scale, as a multiple of the framing that
 * fits the state.
 *
 * The state is always drawn in detail, at every zoom: it is the only ground with figures
 * on it, and a reader looking at the whole country should be able to see where the data
 * is. What follows the zoom is counties or municipalities — 564 outlines at national
 * zoom are a smudge, and they cost time to project.
 */
function detailFor(scale: number, nj: number): DetailLevel {
  return scale < nj * 1.15 ? "county" : "municipality";
}

/**
 * Which copy of the towns to draw: the hard-simplified one while the whole state is in
 * frame, the full one once the reader is close enough for the detail to show.
 *
 * All 564 are on screen at the wide end, where culling saves nothing and a town is a few
 * dozen pixels across — 15,364 points there instead of 41,609, for a difference nobody
 * can see. Past this the reader is close in, most of the state is off screen, and the
 * fine layer is cheap again because most of it is culled.
 */
function townLayer(
  scale: number,
  nj: number,
): "municipality" | "municipalityWide" {
  return scale < nj * 3 ? "municipalityWide" : "municipality";
}

export function GlobeMap({
  appearance = "classic",
  width,
  height,
  file,
  layers,
  failed,
  metric,
  windowKey,
  metricLabel,
  windowPhrase,
  format,
  formatChange,
  active = null,
  mute = false,
  onView,
  paint,
  legend,
  pin,
  frameOn = null,
  describe,
}: Props) {
  const [camera, setCamera] = useState<Camera | null>(null);
  // The probe's rise belongs to one region. Keeping the id beside the height prevents a
  // newly focused shape inheriting the old shape's lift for one frame.
  const [lift, setLift] = useState<{ id: number | string | null; value: number }>({ id: null, value: 0 });
  // The crosshair mark itself, off until asked for. The focus treatment already says
  // what the map is holding, and a permanent reticle over a map of somebody's home town
  // reads like a gunsight; the readers who want the exact point can turn it on.
  const [crosshair, setCrosshair] = useState(false);
  const settling = useRef<number | null>(null);
  const frame = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    at: number;
  } | null>(null);
  const glide = useRef<number | null>(null);
  // Pointer movement waiting to be applied, and the frame that will apply it.
  const pending = useRef({ dx: 0, dy: 0 });
  const queued = useRef<number | null>(null);
  const groundRef = useRef<SVGGElement>(null);
  const detailRef = useRef<SVGGElement>(null);
  /** Repaint at a camera, now, in this frame. Reassigned every render, below. */
  const repaint = useRef<(cam: Camera) => void>(() => {});
  /** Look again at what the crosshair is over. Reassigned every render, below. */
  const look = useRef<() => void>(() => {});
  // Bumped when a drag or a flight ends, to make the crosshair look again.
  const [settled, setSettled] = useState(0);
  // Whether the camera is moving under the reader's hand — the drag and the glide that
  // follows it. State rather than a ref because the depth of field reads it: see
  // `focusing` below for why the blur cannot run while the map is moving.
  const [moving, setMoving] = useState(false);
  const flight = useRef<number | null>(null);
  // The camera the callbacks read synchronously. State drives the render; a flight has
  // to know where it is starting from at the moment the button is pressed. Not `at`,
  // which is the hit test this module imports.
  const standing = useRef<Camera | null>(null);

  // The two framings every jump and every threshold is measured against.
  // The painted canvas: the window plus the margin the slide draws into.
  const fw = width + PAD * 2;
  const fh = height + PAD * 2;

  const framings = useMemo(() => {
    if (!layers) return null;
    const county = framedOn(layers.county, { width, height });
    return {
      nation: framedOn(
        layers.nation.filter(
          (outline) => !OFF_THE_CONTINENT.has(String(outline.id)),
        ),
        { width, height, padding: NATION_PADDING },
      ),
      // Centre a little south of the geometric fit. New Jersey then sits higher in the
      // frame, clear of the county-entry control without changing its scale.
      county: { ...county, lat: county.lat - 0.28 },
    };
  }, [layers, width, height]);

  useEffect(() => {
    if (framings && !camera) setCamera(framings.county);
  }, [framings, camera]);

  standing.current = camera;

  const level: DetailLevel =
    pin ??
    (framings && camera
      ? detailFor(camera.scale, framings.county.scale)
      : "county");
  // Change over the window where the measure publishes one, so the window control
  // moves the map as well as the ranking (`readingsFor`).
  const basis = useMemo(
    () => readingsFor(file, metric, windowKey),
    [file, metric, windowKey],
  );
  const readings = basis.values;
  // The outlines for the level in view, chosen once. The crosshair must test the very
  // shapes that were drawn, or it can name a town whose edge is somewhere else.
  const inView = useMemo(() => {
    if (!layers) return [];
    if (level !== "municipality" || !camera || !framings) return layers[level];
    return layers[townLayer(camera.scale, framings.county.scale)];
  }, [layers, level, camera, framings]);
  const show = basis.kind === "change" ? formatChange : format;
  // Read by the pan callbacks, which must not depend on it: see `slideBy`.
  //
  // Municipal level, framed at least as close as the whole state: that is where 564
  // outlines are on screen at a size worth rasterising, and it is also where a translate
  // is closest to the rotation it stands in for. The state framing is scale 10,458, and
  // the drift at the moment before a commit is about 2.2px there — a half of one percent
  // of the frame — against 6.6px with the country in view, which is why zooming out past
  // the state hands the pan back to the projection.
  const sliding = useRef(false);
  sliding.current =
    level === "municipality" &&
    Boolean(camera && framings && camera.scale >= framings.county.scale);

  /**
   * Everything the map draws, at a given camera.
   *
   * A function rather than only a memo, because a slide has to be able to repaint at a
   * camera React has not been told about yet — see `commit`. The memo below is this
   * same call for the camera React does know about.
   */
  const build = useCallback(
    (cam: Camera) => {
      if (!layers) return null;
      const v = view(cam);
      const detail = inView;
      // Across the range on screen, not from zero: a change crosses zero, so there is no
      // zero to rise from. Rising from zero was right while every region was a block and
      // two could be compared side by side; only one rises now, so the range is the
      // expressive thing to spend the height on, and the legend names both ends.
      const seen = detail
        .map((outline) => readings?.[String(outline.id)])
        .filter((value): value is number => value !== undefined);
      const lowest = seen.length > 0 ? Math.min(...seen) : 0;
      const highest = seen.length > 0 ? Math.max(...seen) : 0;
      const span = highest - lowest;
      const probe = (id: number | string) => {
        const value = readings?.[String(id)];
        if (value === undefined || span <= 0) return 0;
        return ((value - lowest) / span) * height * MAX_LIFT;
      };
      return {
        world: scene(v, WORLD_LAND, () => 0),
        ground: scene(v, layers.nation, () => 0),
        // Flat, all of them. The one raised region is a memo of its own below, so easing
        // the rise no longer re-projects 41,609 points sixty times a second.
        //
        detail: scene(v, detail, () => 0),
        probe,
        lowest,
        highest,
        v,
      };
    },
    [layers, readings, height, inView],
  );

  const drawn = useMemo(
    () => (camera ? build(camera) : null),
    [build, camera],
  );

  // What the rise is easing towards, and the single raised prism it produces. Split from
  // the scene above so that the only thing recomputed per frame of the ease is one
  // region's geometry.
  const target = drawn && active !== null ? drawn.probe(active) : 0;
  const raised = useMemo(() => {
    if (!drawn || !layers || !camera || active === null || lift.id !== active || lift.value <= 0)
      return null;
    const outline = inView.find((o) => o.id === active);
    return outline ? prism(drawn.v, outline, lift.value) : null;
  }, [drawn, layers, camera, level, active, lift]);

  // Each newly focused entity makes one complete, fixed-duration rise from the surface.
  // The prior exponential ease reused the previous entity's partial height, which read
  // as an instant jump followed by a second slow rise when the pointer crossed a line.
  useLayoutEffect(() => {
    if (settling.current !== null) cancelAnimationFrame(settling.current);
    settling.current = null;
    const still =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (active === null || target <= 0) {
      setLift({ id: active, value: 0 });
      return;
    }
    if (still) {
      setLift({ id: active, value: target });
      return;
    }
    setLift({ id: active, value: 0 });
    const began = performance.now();
    const duration = 380;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setLift({ id: active, value: target * eased });
      settling.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    settling.current = requestAnimationFrame(step);
    return () => {
      if (settling.current !== null) cancelAnimationFrame(settling.current);
      settling.current = null;
    };
  }, [active, target]);

  /** The two painted layers, as `lib/paint.ts` wants them. */
  const painting = (built: NonNullable<ReturnType<typeof build>>) => ({
    ground: [...built.world.map((shape) => ({
      id: shape.id,
      d: shape.base,
      fill: null,
      className: "globe-world-land",
    })), ...built.ground.map((shape) => ({
      id: shape.id,
      d: shape.base,
      fill: null,
      className: shape.id === "NJ" ? "with-figures" : "",
    }))],
    detail: built.detail.map((shape) => {
      const fill = fillFor(shape.id);
      // No figure here: it joins the ground rather than becoming a dark class of its
      // own, which left the state looking moth-eaten at municipal zoom.
      if (fill === null) {
        return {
          id: shape.id,
          d: shape.base,
          fill: null,
          className: "globe-absent",
        };
      }
      return {
        id: shape.id,
        d: shape.top,
        fill,
        className: shape.id === active ? "globe-region on" : "globe-region",
      };
    }),
  });

  const put = (built: NonNullable<ReturnType<typeof build>>) => {
    const next = painting(built);
    if (groundRef.current) paintInto(groundRef.current, next.ground);
    if (detailRef.current) paintInto(detailRef.current, next.detail);
  };

  // Reassigned every render so the slide always paints with the current colors and the
  // current level, without any of that being a dependency of the callbacks that pan.
  repaint.current = (cam: Camera) => {
    const built = build(cam);
    if (built) put(built);
  };

  // Build the paths the finest level will need, and touch every outline's bounding cap,
  // while nobody is waiting. Both are one-time costs that otherwise land on the single
  // frame a zoom crosses into municipalities — the frame that already has a whole level
  // of geometry to project. The caps are the larger of the two at 2.9ms, and `capOf`
  // holds them in a `WeakMap` keyed on the outline, so touching them here is all it
  // takes; `reserve` does the same for the elements.
  useEffect(() => {
    if (!layers || !camera) return;
    const idle =
      globalThis.requestIdleCallback ??
      ((run: () => void) => globalThis.setTimeout(run, 200));
    const token = idle(() => {
      const deepest = Math.max(
        layers.municipality.length,
        layers.municipalityWide.length,
        layers.county.length,
      );
      if (detailRef.current) reserve(detailRef.current, deepest);
      if (groundRef.current) reserve(groundRef.current, WORLD_LAND.length + layers.nation.length);
      const probe = view(camera);
      for (const level of [
        WORLD_LAND,
        layers.municipality,
        layers.municipalityWide,
        layers.county,
        layers.nation,
      ]) {
        warm(probe, level);
      }
    });
    return () => {
      if (globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(token);
      else globalThis.clearTimeout(token);
    };
    // Once per set of outlines. The camera only supplies a frame to measure against.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // The region under the middle of the frame, which is what the crosshair marks.
  //
  // New Jersey first, then the ground: a reader over Ohio gets Ohio rather than nothing,
  // and a reader over New Jersey gets the county, not the state beneath it. A backdrop
  // state has no reading by definition, which is not the same as a New Jersey town whose
  // measure is unpublished; the level tells them apart.
  const holding = useCallback(
    (v: ReturnType<typeof view>): Focus | null => {
      if (!layers) return null;
      const middle: [number, number] = [fw / 2, fh / 2];
      const inState = at(v, inView, middle);
      if (inState) {
        const value = readings?.[String(inState.id)];
        return {
          id: inState.id,
          name: inState.name,
          level,
          value: value ?? null,
        };
      }
      const onGround = at(v, layers.nation, middle);
      return onGround
        ? { id: onGround.id, name: onGround.name, level: "state", value: null }
        : null;
    },
    [layers, inView, readings, level, fw, fh],
  );

  const centre = useMemo(
    () => (camera && drawn ? holding(drawn.v) : null),
    // `settled` is not read here; it is what makes the map look again once it stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera, drawn, holding, settled],
  );

  // What the crosshair is over while the layer is slid off its camera.
  //
  // Between commits `drawn` is the camera the layer was painted at, not the one the
  // reader is looking at, so the crosshair has to ask for itself. This is the only work
  // a slide frame does besides writing the transform — one hit test, 0.68ms over 564
  // outlines — and it is what keeps the promise that the readout follows the drag
  // rather than waiting for the hand to come off.
  const [live, setLive] = useState<Focus | null>(null);
  look.current = () => {
    if (!standing.current) return;
    const next = holding(
      view(shifted(standing.current, shift.current.x, shift.current.y)),
    );
    setLive((was) =>
      was && next && was.id === next.id && was.level === next.level ? was : next,
    );
  };
  const focus = moving ? (live ?? centre) : centre;

  // Held in a ref, not a dependency: the page passes a fresh closure on every render,
  // and depending on it here would fire this effect every render and set state in a loop.
  const report = useRef(onView);
  report.current = onView;
  // Only when the answer actually changes. `centre` is a fresh object every time the
  // camera moves, so reporting on its identity told the page sixty times a second that
  // the crosshair was still on the same town — and every one of those set state in the
  // page, which re-rendered whatever it hangs off the focus. On `/afford` that is two
  // tables and a form; a drag across a single town now re-renders none of it, and
  // crossing into the next one re-renders it once.
  const told = useRef<Focus | null>(null);
  useEffect(() => {
    const before = told.current;
    const same =
      before === focus ||
      (before !== null &&
        focus !== null &&
        before.id === focus.id &&
        before.level === focus.level &&
        before.value === focus.value);
    if (same) return;
    told.current = focus;
    report.current?.({ level, focus });
  }, [focus, level]);

  // Over the level on screen, not over a fixed set: 21 counties and 564 towns spread
  // differently, and quintiles of the counties would put most towns in one class.
  const ramp = useMemo(() => {
    // The ramp's hue follows the measure's group, so the map says what kind of
    // question it is answering as well as how much (`lib/groups.ts`).
    const sequential = rampFor(metric);
    if (!layers)
      return {
        palette: sequential,
        breaks: [] as number[],
        observed: [] as number[],
      };
    const observed = sortedValues(
      inView
        .map((outline) => readings?.[String(outline.id)])
        .filter((value): value is number => value !== undefined),
    );
    const palette = straddlesZero(observed) ? DIVERGING : sequential;
    return {
      palette,
      breaks: observed.length > 4 ? quantileBreaks(observed) : [],
      observed,
    };
  }, [inView, readings, metric]);

  /**
   * A region's fill, or null when it has no figure and is drawn as ground.
   *
   * Three states, and they must not collapse into two. A region with a figure takes its
   * step of the ramp. A region muted for another's sake takes `--mute`, a grey the
   * ramp's lowest step cannot be mistaken for. A region with no figure is not a class at
   * all — 176 of 564 towns have no Zillow value, and giving them a dark step of their
   * own left the state looking moth-eaten when the truth is that nobody published a
   * figure there.
   */
  const fillFor = (id: number | string): string | null => {
    if (paint) return paint(id);
    const value = readings?.[String(id)];
    if (value === undefined || ramp.breaks.length === 0) return null;
    if (mute && id !== active) return "var(--mute)";
    return ramp.palette[classIndex(value, ramp.breaks)];
  };

  // Paint only when geometry or its styling changes. The old unbounded layout effect
  // scanned every path's attributes on EVERY frame of the isolated probe animation.
  // `rise`, `live` and control state do not change the ground/detail layers at all.
  useLayoutEffect(() => {
    if (drawn) put(drawn);
    // put/painting/fillFor are render-local closures; these are all their inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, active, mute, paint, ramp]);

  /**
   * Apply pointer movement at most once a frame.
   *
   * A trackpad or a high-refresh screen delivers pointer events faster than the browser
   * paints — up to 120 a second — and the map was re-projecting the whole level for
   * every one of them. Measured at municipal zoom before this: 550 path rewrites per
   * pointer event. Collecting the deltas and spending them once per frame does the same
   * pan for a fraction of the work, and the map moves exactly as far.
   */
  const slideBox = useRef<HTMLDivElement>(null);
  /** How far the painted layer has been slid from the camera it was drawn at. */
  const shift = useRef({ x: 0, y: 0 });
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  /**
   * Move the painted layer, without repainting it.
   *
   * Written to the nodes rather than through React on purpose. The earlier version of
   * this asked React for the new camera at the same moment it cleared the transform —
   * and React delivers a render later, so for a frame or two the map was drawn at the
   * camera it had just left with the transform already gone, snapping back to the start
   * of the drag and then jumping forward. Nothing here waits for a render.
   */
  const wear = useCallback((x: number, y: number) => {
    const box = slideBox.current;
    if (!box) return;
    if (x === 0 && y === 0) {
      box.style.transform = "";
      return;
    }
    // The shift is in frame units; the element moves in CSS pixels, and the map is drawn
    // to whatever width the column gives it. One frame unit is the stage's own width over
    // the window's.
    const per = box.clientWidth > 0 ? box.clientWidth / width : 1;
    box.style.transform = `translate3d(${x * per}px, ${y * per}px, 0)`;
  }, [width]);

  /**
   * Take the slide off and put the camera where it had reached.
   *
   * The repaint, the cleared transform and the state update all happen here, in this
   * order, in one frame: the layer is already showing the new camera before the browser
   * paints, so React's render arrives to a picture that is already correct and
   * `lib/paint.ts` finds nothing to write.
   */
  const commit = useCallback(() => {
    const { x, y } = shift.current;
    if (!standing.current || (x === 0 && y === 0)) return;
    const next = shifted(standing.current, x, y);
    shift.current = { x: 0, y: 0 };
    standing.current = next;
    repaint.current(next);
    wear(0, 0);
    setCamera(next);
  }, [wear]);

  /**
   * A pan: slide what is painted, and repaint only when the margin runs out.
   *
   * This is the whole point of the over-drawn canvas. A frame of a drag used to
   * re-project 41,609 points, build half a megabyte of path data and hand it to the
   * browser to rasterise; it now writes one transform, which the compositor applies to
   * a surface it has already got. The margin is what makes it honest — there is real
   * ground painted out there to slide in, not empty frame.
   *
   * Sliding is not rotating, and over a large enough pan the two visibly differ, which
   * is what the budget is for: at four fifths of the margin the camera commits and the
   * map is projected properly again.
   */
  /** The camera a pan arrives at, through React, for the zooms that do not slide. */
  const move = useCallback((dx: number, dy: number) => {
    setCamera((current) => (current ? shifted(current, dx, dy) : current));
  }, []);

  const slideBy = useCallback(
    (x: number, y: number) => {
      // Only where the map is both heavy and nearly flat. A translate is not a rotation,
      // and the gap between them grows as the frame covers more of the globe: measured
      // against the true projection at the moment before a commit, the worst point in
      // the window is 2.45px out at municipal zoom, 3.3px at county and 6px with the
      // country in frame. The first is a fifth of a percent of the frame and is corrected
      // at every commit; the last would be a visible squash. `sliding` above is the
      // gate, and every zoom outside it re-projects the way it always did.
      if (!sliding.current) {
        move(x, y);
        look.current();
        return;
      }
      shift.current = { x: shift.current.x + x, y: shift.current.y + y };
      if (Math.hypot(shift.current.x, shift.current.y) > PAD * 0.8) {
        commit();
        return;
      }
      wear(shift.current.x, shift.current.y);
      look.current();
    },
    [commit, wear, move],
  );

  /**
   * Deltas collected and spent once a frame.
   *
   * A trackpad or a high-refresh screen delivers pointer events faster than the browser
   * paints — up to 120 a second — and the map was re-projecting the whole level for
   * every one of them. Measured at municipal zoom before this: 550 path rewrites per
   * pointer event. Collecting the deltas and spending them once per frame does the same
   * pan for a fraction of the work, and the map moves exactly as far.
   */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      pending.current.dx += dx;
      pending.current.dy += dy;
      if (queued.current !== null) return;
      queued.current = requestAnimationFrame(() => {
        queued.current = null;
        const { dx: x, dy: y } = pending.current;
        pending.current = { dx: 0, dy: 0 };
        if (x !== 0 || y !== 0) slideBy(x, y);
      });
    },
    [slideBy, commit],
  );

  // A pointer can be released before its queued frame runs. Spend that last movement
  // before committing, otherwise a late callback can leave an uncommitted slide behind.
  const flush = useCallback(() => {
    if (queued.current !== null) cancelAnimationFrame(queued.current);
    queued.current = null;
    const { dx, dy } = pending.current;
    pending.current = { dx: 0, dy: 0 };
    if (dx || dy) slideBy(dx, dy);
  }, [slideBy]);

  useEffect(() => () => {
    for (const loop of [queued, glide, flight]) {
      if (loop.current !== null) cancelAnimationFrame(loop.current);
      loop.current = null;
    }
  }, []);

  /**
   * Carry on moving after the hand lets go, slowing to a stop.
   *
   * What a globe does when you spin it, and what the map felt like it was missing: a
   * drag that stops dead the instant the button comes up reads as a picture being
   * shoved rather than a world being turned. Friction per frame rather than a fixed
   * distance, so a flick travels further than a nudge; under a fifth of a pixel a frame
   * it stops, which is below what anyone can see.
   */
  const coast = useCallback(
    (thrown: { vx: number; vy: number } | null) => {
      if (!thrown) return;
      if (typeof globalThis.matchMedia === "function") {
        if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
      }
      let { vx, vy } = thrown;
      // A frame's worth of the measured pixels-per-millisecond.
      vx *= 16;
      vy *= 16;
      const thrownHard = Math.hypot(vx, vy) > 26;
      // A tenth slower off an ordinary drag, so it settles rather than skids — but a
      // hard flick keeps its speed and carries, which is the difference between nudging
      // a globe and spinning one.
      const carry = thrownHard ? 1.15 : 0.9;
      vx *= carry;
      vy *= carry;
      if (Math.hypot(vx, vy) < 1) return;
      const step = () => {
        const friction = Math.hypot(vx, vy) > 26 ? 0.965 : 0.94;
        vx *= friction;
        vy *= friction;
        if (Math.hypot(vx, vy) < 0.2) {
          glide.current = null;
          commit();
          setMoving(false);
          return;
        }
        slideBy(vx, vy);
        glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    },
    [slideBy],
  );

  /**
   * Frame one region and go a level in: the country to its counties, a county to its
   * towns.
   *
   * The zoom buttons move the camera by a fixed factor, which makes reaching one
   * municipality out of 564 a chore. This is the shortcut the crosshair earns —
   * whatever it is already holding, framed. Padded looser than a tight fit so the
   * region arrives with its neighbours around it: the comparison is the product.
   */
  /**
   * Move the camera there over about a second rather than cutting to it.
   *
   * A cut leaves the reader to work out where they have landed; a flight carries their
   * eye with it, which is the whole reason a globe is navigated rather than paged. The
   * scale is interpolated on a log, so every frame of the zoom changes it by the same
   * ratio — linear scale races at one end and crawls at the other, which is the thing
   * that makes a fly-to feel wrong. The duration grows with how far it travels, so a
   * nudge is quick and a hop across the country takes its time.
   */
  /**
   * Where the camera is headed, while it is still on its way.
   *
   * A zoom steps from here rather than from the live position, so the buttons can be
   * pressed as fast as a reader likes: each press is another whole step. Reading the
   * live camera instead meant a second press a few frames in stepped from almost where
   * the first press started, so spamming the button barely moved the map and the reader
   * had to wait out each flight to get anywhere.
   */
  const aim = useRef<Camera | null>(null);

  const flyTo = useCallback((to: Camera) => {
    if (glide.current !== null) cancelAnimationFrame(glide.current);
    glide.current = null;
    if (flight.current !== null) cancelAnimationFrame(flight.current);
    flight.current = null;

    const from = standing.current;
    const still =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || still) {
      aim.current = null;
      setCamera(to);
      return;
    }
    aim.current = to;

    const turns = Math.hypot(to.lon - from.lon, to.lat - from.lat) / 40;
    const zooms = Math.abs(Math.log(to.scale / from.scale)) / Math.log(8);
    const span = Math.min(1150, 420 + Math.max(turns, zooms) * 520);
    const started = performance.now();
    // A flight is motion, and until now it was the only motion that did not say so: it
    // re-projected 564 outlines at full precision sixty times a second for up to 1.15
    // seconds, with both drop-shadows still running and the controls still reading the
    // map back through their glass. Every press of a zoom button paid for all of it.
    // The crosshair reverts to the settled reading, which recomputes each frame from the
    // camera the flight is actually at; `live` belongs to a slide and would be stale.
    setMoving(true);
    setLive(null);

    const step = (now: number) => {
      const through = Math.min(1, (now - started) / span);
      // Ease in and out: the eye is given time to leave and time to arrive.
      const eased =
        through < 0.5
          ? 4 * through * through * through
          : 1 - Math.pow(-2 * through + 2, 3) / 2;
      setCamera({
        ...to,
        lon: from.lon + (to.lon - from.lon) * eased,
        lat: from.lat + (to.lat - from.lat) * eased,
        scale: from.scale * Math.pow(to.scale / from.scale, eased),
      });
      flight.current = through < 1 ? requestAnimationFrame(step) : null;
      if (flight.current === null) {
        aim.current = null;
        setMoving(false);
      }
    };
    flight.current = requestAnimationFrame(step);
  }, []);

  /**
   * Frame one region and go a level in: a county to its towns.
   *
   * The zoom buttons move the camera by a fixed factor, which makes reaching one
   * municipality out of 564 a chore. This is the shortcut the crosshair earns —
   * whatever it is already holding, framed. Padded looser than a tight fit so the
   * region arrives with its neighbours around it: the comparison is the product.
   */
  const dive = useCallback(
    (outline: Outline) => {
      flyTo(framedOn([outline], { width, height, padding: 0.62 }));
    },
    [flyTo, width, height],
  );

  /**
   * Carry the camera to a region the page has asked for.
   *
   * Keyed on the id rather than on the outline, and remembered, so the flight happens
   * once per choice: `/afford` re-renders on every crosshair move, and re-framing on
   * each of those would fight the reader for the camera. A place chosen before the
   * outlines arrive is honoured when they do, which is what makes `?place=` in the
   * address work on a cold load.
   */
  const framed = useRef<number | string | null>(null);
  useEffect(() => {
    if (frameOn === null || !layers) return;
    if (framed.current === frameOn) return;
    const outline =
      layers.municipality.find((one) => one.id === frameOn) ??
      layers.county.find((one) => one.id === frameOn);
    if (!outline) return;
    framed.current = frameOn;
    flyTo(framedOn([outline], { width, height, padding: 0.62 }));
  }, [frameOn, layers, flyTo, width, height]);

  const zoom = useCallback(
    (factor: number) => {
      // The slide is off the camera's books until it commits, and this reads the camera.
      commit();
      const current = aim.current ?? standing.current;
      if (!current || !framings) return;
      const lowest = framings.nation.scale * 0.85;
      const highest = framings.county.scale * 22;
      flyTo({
        ...current,
        scale: Math.max(lowest, Math.min(highest, current.scale * factor)),
      });
    },
    [flyTo, framings, commit],
  );

  if (failed) {
    return (
      <p className="meta">
        The map could not be loaded. The ranking beside it carries the same
        figures.
      </p>
    );
  }
  if (!drawn || !camera || !framings) {
    return (
      <div className="map-loading" style={{ height }}>
        {/* This is also what a reader with no JavaScript is left with, since the map
            asks for its outlines on mount and never gets them. The figures are not lost
            with it: the ranking beside the map is server-rendered and carries every one,
            so the page still answers — it just cannot be flown over. */}
        <noscript>
          <p className="meta">
            The map needs JavaScript to draw. The ranking beside it carries the
            same figures, and every place links to its own page.
          </p>
        </noscript>
      </div>
    );
  }

  const shown = level === "county" ? "counties" : "municipalities";
  const drawnHere = inView.length;
  // The focus treatment runs only while something is held and the reader has not asked
  // for less motion; drawing it while dragging would blur 564 paths every frame.
  // Whether the map should be pulling focus. The layers it drives are always in the
  // document and change only their opacity and blur, so CSS carries them in and out —
  // an instant vignette reads as a light switch, where a lens takes a moment to find
  // its subject.
  // A drag no longer suspends it: the crosshair is live through a slide, so the focus
  // can follow it. A flight still does, because the camera is crossing the country and
  // there is nothing to focus on until it lands.
  const attending = active !== null && flight.current === null;
  // The depth of field, separately, because it is the map's largest cost and it is
  // worthless while the map is moving.
  //
  // Each blurred layer is a full-frame offscreen surface the CPU has to rasterise and
  // then convolve: the near layer at 1.1px, and the far layer — which is the same 564
  // paths again through `<use>` — at 5.5px. Five megapixels of Gaussian per frame, for
  // a focus effect on a picture that is sliding under the reader's hand and cannot be
  // read anyway. The original code suspended it during a drag for exactly this reason;
  // making the crosshair live through a drag took the suspension with it, which is when
  // the municipal zoom became unusable. The crosshair stays live, the blur does not.
  const focusing = appearance === "classic" && attending && !moving;
  // Independent of `focusing`: the raised region and its shadow belong to the rise,
  // which has its own easing, and should not wait on the focus to arrive. `raised` is
  // the eased prism; before the rise has started there is nothing to draw over the top,
  // and the flat copy in the scene below is already correct.
  const sharp =
    raised ??
    (active === null
      ? null
      : (drawn.detail.find((shape) => shape.id === active) ?? null));
  const sharpFill = sharp
    ? (fillFor(sharp.id) ?? "var(--nodata)")
    : "var(--nodata)";
  // What the crosshair is holding, as an outline the camera can be framed on.
  //
  // Counties only. A municipality is the finest level the warehouse holds, so there is
  // nothing beneath it; and a backdrop state has no counties loaded, so "Jump into
  // Missouri" would land the reader on empty ground — while New Jersey, the one state
  // that does have them, already has a button of its own.
  const diveTo =
    focus && focus.level === "county" && layers
      ? (layers.county.find((outline) => outline.id === focus.id) ?? null)
      : null;
  const withFigures = ramp.observed.length;

  return (
    <figure className={moving ? "globe globe-moving" : "globe"}>
      {/* The frame and its controls are one object: the controls float over the map
          rather than sitting under it, so the map is the whole panel and the buttons
          are where a reader's hand already is. */}
      <div
        className="globe-stage"
        style={
          {
            "--globe-aspect": `${width} / ${height}`,
            "--globe-over-x": fw / width,
            "--globe-over-y": fh / height,
          } as CSSProperties
        }
      >
        {/* The map, drawn PAD past the window on every side and moved as one element.
            An HTML wrapper rather than a group inside the SVG: a transform on an HTML
            element with `will-change` gets its own compositor surface, where an SVG
            group is very often painted with its parent instead — which would have made
            the slide skip the projection and then repaint anyway. */}
        <div className="globe-slide" ref={slideBox}>
          <svg
            ref={frame}
            viewBox={`0 0 ${fw} ${fh}`}
            className="globe-frame"
            aria-hidden="true"
          >
          {/* The ground: every state, always, so panning off New Jersey shows a country
            rather than nothing. They carry no figures and are not colored as if they do. */}
          <defs>
            {/* Paper grain for the ground. Real noise rather than a tiled dot, which
                reads as a grid at this size. Static, and on one layer only. */}
            <filter id="globe-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <pattern
              id="globe-ground-fill"
              width="140"
              height="140"
              patternUnits="userSpaceOnUse"
            >
              <rect width="140" height="140" fill="var(--nodata)" />
              <rect
                width="140"
                height="140"
                filter="url(#globe-grain)"
                opacity="0.06"
              />
            </pattern>

            {/* And the same shape as a mask, so a second, heavier blur of the very same
                paths shows only towards the edge. SVG cannot vary a blur radius across a
                shape, so the depth of field is two blurs with one fading in over the
                other — and `use` instances the layer rather than drawing it twice. */}
            <radialGradient id="globe-far" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#000000" />
              <stop offset="40%" stopColor="#000000" />
              <stop offset="100%" stopColor="#ffffff" />
            </radialGradient>
            <mask id="globe-edge">
              <rect x={0} y={0} width={fw} height={fh} fill="url(#globe-far)" />
            </mask>
          </defs>

          <g>
            {/* Both layers are filled by `lib/paint.ts` rather than by React. A region
                is a `d` and a colour — no state, no events, nothing React's diffing buys
                anything for — and building 564 of them through it was most of a frame. */}
            <g ref={groundRef} className="globe-ground" />
            <g
              ref={detailRef}
              id="globe-detail-layer"
              className={focusing ? "globe-detail soft" : "globe-detail"}
            />
            {/* The same paths again, blurred harder and masked so they only show towards
              the edge — the far half of a depth of field. `use` instances the layer, so
              this costs one element rather than another 564. */}
            {appearance === "classic" && <use
              href="#globe-detail-layer"
              className={focusing ? "globe-detail-far on" : "globe-detail-far"}
              mask="url(#globe-edge)"
            />}
          </g>
          {/* The focused region drawn again, over the softened rest and the vignette,
              so it alone stays sharp and at full color. Twice is cheaper than excluding
              it from a filtered group, and it keeps the painter's order. */}
          {/* In its own group, so it keeps the painter's order above the layers it is
              drawn over. It slides with them, being inside the same wrapper. */}
          <g>
            {sharp && (
              <g className="globe-region on globe-sharp">
                {sharp.walls && (
                  <path className="wall" d={sharp.walls} fill={sharpFill} />
                )}
                <path className="top" d={sharp.top} fill={sharpFill} />
              </g>
            )}
          </g>
          </svg>
        </div>

        {/* The frame the map moves under: the vignette, the crosshair, and the gesture
            itself. Still, so a pan does not drag the reticle off the middle, and on top,
            so it is the surface a pointer lands on. */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="globe-still"
          role="img"
          aria-label={
            describe ??
            `New Jersey on a map of the United States, showing ${shown} colored by ` +
              `${metricLabel}. The one under the crosshair rises with its own figure. ` +
              `The ranking beside the map carries the same figures.`
          }
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            press.current = { x: event.clientX, y: event.clientY, moved: false };
            // Taking the map in hand interrupts an in-progress zoom instead of letting
            // two independent camera writers fight over the gesture.
            if (flight.current !== null) cancelAnimationFrame(flight.current);
            flight.current = null;
            aim.current = null;
            if (glide.current !== null) cancelAnimationFrame(glide.current);
            glide.current = null;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              vx: 0,
              vy: 0,
              at: event.timeStamp,
            };
            setMoving(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 6) press.current.moved = true;
            const box = event.currentTarget.getBoundingClientRect();
            // The SVG is scaled to its box, so a pixel on screen is not a unit in the
            // viewBox. Without this the map drifts from the cursor on a narrow screen.
            const perPixel = width / box.width;
            const dx = (event.clientX - drag.current.x) * perPixel;
            const dy = (event.clientY - drag.current.y) * perPixel;
            const dt = Math.max(1, event.timeStamp - drag.current.at);
            nudge(dx, dy);
            // Velocity is smoothed, not raw: one jittery sample at the moment of
            // release would throw the glide in a direction the hand never went.
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              vx: drag.current.vx * 0.7 + (dx / dt) * 0.3,
              vy: drag.current.vy * 0.7 + (dy / dt) * 0.3,
              at: event.timeStamp,
            };
          }}
          onPointerUp={(event) => {
            if (!drag.current) return;
            flush();
            const thrown = drag.current;
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            const tapped = press.current;
            press.current = null;
            if (appearance === "atlas" && level === "county" && tapped && !tapped.moved && standing.current && layers) {
              const box = event.currentTarget.getBoundingClientRect();
              const point: [number, number] = [
                (event.clientX - box.left) * width / box.width + PAD,
                (event.clientY - box.top) * height / box.height + PAD,
              ];
              // The lifted top is above its geographic footprint; tapping it should
              // enter that county, not its neighbour underneath the raised shape.
              const top = event.currentTarget.parentElement?.querySelector<SVGPathElement>(".globe-sharp .top");
              const matrix = top?.getScreenCTM();
              const onTop = top && matrix && top.isPointInFill(new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()));
              const hit = (onTop ? layers.county.find((outline) => outline.id === sharp?.id) : null)
                ?? at(view(shifted(standing.current, shift.current.x, shift.current.y)), layers.county, point);
              if (hit) {
                commit();
                setMoving(false);
                dive(hit);
                return;
              }
            }
            coast(thrown);
            // `coast` sets the glide synchronously if it starts one, so this is the
            // moment it is known whether the map is still moving. A drag that ends
            // without a throw commits here; one that glides commits when it stops.
            if (glide.current === null) {
              commit();
              setMoving(false);
            }
            setSettled((n) => n + 1);
          }}
          onPointerCancel={() => {
            press.current = null;
            flush();
            drag.current = null;
            commit();
            setMoving(false);
          }}
          onWheel={(event) => {
            // Only with a modifier held. A bare wheel over the map is the reader scrolling
            // the page past it, and swallowing that traps them on a tall map.
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            zoom(Math.pow(0.999, -event.deltaY));
          }}
        >
          <defs>
              {/* Clear over the middle of the frame, closing to the page's own surface at
                  the edge. */}
              <radialGradient id="globe-fade" cx="50%" cy="50%" r="60%">
                <stop
                  offset="0%"
                  stopColor="var(--surface-card)"
                  stopOpacity="0"
                />
                <stop
                  offset="34%"
                  stopColor="var(--surface-card)"
                  stopOpacity="0"
                />
                <stop
                  offset="70%"
                  stopColor="var(--surface-card)"
                  stopOpacity="0.46"
                />
                <stop
                  offset="100%"
                  stopColor="var(--surface-card)"
                  stopOpacity="0.86"
                />
              </radialGradient>
          </defs>
          {/* A vignette that closes in on whatever the crosshair holds. The ground
              around it keeps its color and its shape, only quieter, so the comparison
              the whole site is built on is still there to read. */}
          {appearance === "classic" && <rect
            className={attending ? "globe-vignette on" : "globe-vignette"}
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#globe-fade)"
          />}
          {/* The crosshair. Fixed at the middle of the frame: the reader moves the map
            under it rather than pointing at a place, which is what makes the map
            readable on a touch screen with no hover. */}
          {crosshair && (
            <g className="globe-crosshair" aria-hidden="true">
              <circle cx={width / 2} cy={height / 2} r={9} />
              <line x1={width / 2 - 16} y1={height / 2} x2={width / 2 - 11} y2={height / 2} />
              <line x1={width / 2 + 11} y1={height / 2} x2={width / 2 + 16} y2={height / 2} />
              <line x1={width / 2} y1={height / 2 - 16} x2={width / 2} y2={height / 2 - 11} />
              <line x1={width / 2} y1={height / 2 + 11} x2={width / 2} y2={height / 2 + 16} />
            </g>
          )}
        </svg>

        {appearance === "atlas" && <span className="globe-level-label">{level === "county" ? "County view" : "Municipality view"}</span>}
        <div className="globe-controls globe-controls-jumps">
          <button type="button" onClick={() => flyTo(framings.nation)}>
            United States
          </button>
          <span className="globe-divider" aria-hidden="true" />
          <button type="button" onClick={() => flyTo(framings.county)}>
            New Jersey
          </button>
        </div>
        {focus && diveTo && (
          <button
            type="button"
            className="globe-controls globe-controls-dive"
            onClick={() => dive(diveTo)}
          >
            Jump into {focus.name}
            {focus.level === "county" ? " County" : ""}
            {appearance === "atlas" && <span aria-hidden="true"> ↗</span>}
          </button>
        )}
        <div className="globe-controls globe-controls-zoom">
          <button
            type="button"
            onClick={() => zoom(1 / 1.4)}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="globe-divider" aria-hidden="true" />
          <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom in">
            +
          </button>
          <span className="globe-divider" aria-hidden="true" />
          <button
            type="button"
            className="globe-icon"
            aria-pressed={crosshair}
            aria-label="Show the crosshair"
            title="Show the crosshair"
            onClick={() => setCrosshair((shown) => !shown)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="3.4" />
              <path d="M8 0.6V3.4M8 12.6V15.4M0.6 8H3.4M12.6 8H15.4" />
            </svg>
          </button>
        </div>
      </div>

      <figcaption className="globe-legend">
        {legend ?? (
          <>
            <p className="globe-ramp">
              <b>
                {metricLabel}
                {basis.kind === "change"
                  ? `, change ${windowPhrase}`
                  : ", latest"}
              </b>
              {ramp.breaks.length > 0 &&
                ramp.palette.map((color, index) => {
                  const low =
                    index === 0 ? ramp.observed[0] : ramp.breaks[index - 1];
                  const high =
                    index === ramp.palette.length - 1
                      ? ramp.observed.at(-1)!
                      : ramp.breaks[index];
                  return (
                    <span key={color}>
                      <i className="swatch" style={{ background: color }} />
                      {show(low)} to {show(high)}
                    </span>
                  );
                })}
            </p>
            {withFigures < drawnHere && (
              <p className="globe-coverage">
                <i className="swatch" style={{ background: "var(--nodata)" }} />
                {drawnHere - withFigures} of the {drawnHere} {shown} have no
                figure for this measure, so they are drawn as ground rather than
                as a measurement.
              </p>
            )}
          </>
        )}
        <p className="globe-note">
          {drawn.highest > drawn.lowest && (
            <>
              The region under the crosshair rises with its own figure, from{" "}
              {show(drawn.lowest)} flat to {show(drawn.highest)} at full
              height.{" "}
            </>
          )}
          Only New Jersey carries figures; every other state is drawn as ground,
          not as a measurement. Drag to move the map under the crosshair, which
          reads whatever is beneath it; zoom with the buttons, or hold{" "}
          {"\u2318"} or Ctrl and scroll.
          {appearance === "atlas" && " Click or tap a county to explore its municipalities."}
        </p>
      </figcaption>
    </figure>
  );
}
