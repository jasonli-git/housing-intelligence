"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { rampFor } from "@/lib/groups";
import { type Camera, type Outline, at, fit, scene, view } from "@/lib/globe";
import { type MapFile, readingsFor } from "@/lib/mapdata";
import type { MapLayers } from "@/components/useMapFile";
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

export function GlobeMap({
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
  describe,
}: Props) {
  const [camera, setCamera] = useState<Camera | null>(null);
  // The probe's rise, eased towards its target rather than snapped to it. A block that
  // appears at full height the instant the crosshair crosses a line reads as a glitch;
  // coming up over a few frames reads as the map answering.
  const [rise, setRise] = useState(0);
  // The crosshair mark itself, off until asked for. The focus treatment already says
  // what the map is holding, and a permanent reticle over a map of somebody's home town
  // reads like a gunsight; the readers who want the exact point can turn it on.
  const [crosshair, setCrosshair] = useState(false);
  const risen = useRef({ at: 0, to: 0 });
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
  const flight = useRef<number | null>(null);
  // The camera the callbacks read synchronously. State drives the render; a flight has
  // to know where it is starting from at the moment the button is pressed. Not `at`,
  // which is the hit test this module imports.
  const standing = useRef<Camera | null>(null);

  // The two framings every jump and every threshold is measured against.
  const framings = useMemo(() => {
    if (!layers) return null;
    return {
      nation: fit(
        layers.nation.filter(
          (outline) => !OFF_THE_CONTINENT.has(String(outline.id)),
        ),
        { width, height, padding: NATION_PADDING },
      ),
      county: fit(layers.county, { width, height }),
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
  const show = basis.kind === "change" ? formatChange : format;

  const drawn = useMemo(() => {
    if (!layers || !camera) return null;
    const v = view(camera);
    const detail = layers[level];
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
    const target = active === null ? 0 : probe(active);
    const lift = (id: number | string) => (id === active ? rise : 0);
    return {
      ground: scene(v, layers.nation, () => 0),
      detail: scene(v, detail, lift),
      lowest,
      highest,
      target,
      v,
    };
  }, [layers, camera, level, readings, height, active, rise]);

  // Ease the rise towards whatever the scene last asked for. An exponential approach
  // rather than a fixed duration: a new target part-way through is picked up from where
  // the old one got to, which is what makes sweeping the crosshair feel continuous
  // instead of restarting. Readers who have asked for less motion get the target at
  // once, as everything else on the site does.
  const target = drawn?.target ?? 0;
  useEffect(() => {
    const still =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setRise(target);
      return;
    }
    risen.current.to = target;
    if (settling.current !== null) return;
    const step = () => {
      setRise((current) => {
        const wanted = risen.current.to;
        // A slow approach: the owner found the rise too quick to feel like an
        // answer. About a second to settle, and still interruptible.
        const next = current + (wanted - current) * 0.022;
        if (Math.abs(wanted - next) < 0.25) {
          settling.current = null;
          return wanted;
        }
        settling.current = requestAnimationFrame(step);
        return next;
      });
    };
    settling.current = requestAnimationFrame(step);
    return () => {
      if (settling.current !== null) cancelAnimationFrame(settling.current);
      settling.current = null;
    };
  }, [target]);

  // The region under the middle of the frame, which is what the crosshair marks.
  const centre = useMemo((): Focus | null => {
    if (!layers || !camera || !drawn) return null;
    const middle: [number, number] = [width / 2, height / 2];
    // New Jersey first, then the ground: a reader over Ohio gets Ohio rather than
    // nothing, and a reader over New Jersey gets the county, not the state beneath it.
    const inState = at(drawn.v, layers[level], middle);
    if (inState) {
      const value = readings?.[String(inState.id)];
      return {
        id: inState.id,
        name: inState.name,
        level,
        value: value ?? null,
      };
    }
    const onGround = at(drawn.v, layers.nation, middle);
    // A backdrop state has no reading by definition, which is not the same as a New
    // Jersey town whose measure is unpublished; the level tells them apart.
    return onGround
      ? { id: onGround.id, name: onGround.name, level: "state", value: null }
      : null;
  }, [layers, camera, drawn, level, width, height, readings]);

  // Held in a ref, not a dependency: the page passes a fresh closure on every render,
  // and depending on it here would fire this effect every render and set state in a loop.
  const report = useRef(onView);
  report.current = onView;
  useEffect(() => {
    report.current?.({ level, focus: centre });
  }, [centre, level]);

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
      layers[level]
        .map((outline) => readings?.[String(outline.id)])
        .filter((value): value is number => value !== undefined),
    );
    const palette = straddlesZero(observed) ? DIVERGING : sequential;
    return {
      palette,
      breaks: observed.length > 4 ? quantileBreaks(observed) : [],
      observed,
    };
  }, [layers, level, readings, metric]);

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

  const move = useCallback((dx: number, dy: number) => {
    setCamera((current) => {
      if (!current) return current;
      const perRadian = current.scale;
      const cosLat = Math.max(Math.cos((current.lat * Math.PI) / 180), 0.2);
      const lon = current.lon - ((dx / perRadian) * 180) / Math.PI / cosLat;
      const lat = current.lat + ((dy / perRadian) * 180) / Math.PI;
      // Past the poles the rotation stops being a pan and starts being a tumble.
      return { ...current, lon, lat: Math.max(-80, Math.min(80, lat)) };
    });
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
          return;
        }
        move(vx, vy);
        glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    },
    [move],
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
      setCamera(to);
      return;
    }

    const turns = Math.hypot(to.lon - from.lon, to.lat - from.lat) / 40;
    const zooms = Math.abs(Math.log(to.scale / from.scale)) / Math.log(8);
    const span = Math.min(1150, 420 + Math.max(turns, zooms) * 520);
    const started = performance.now();

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
      flyTo(fit([outline], { width, height, padding: 0.62 }));
    },
    [flyTo, width, height],
  );

  const zoom = useCallback(
    (factor: number) => {
      const current = standing.current;
      if (!current || !framings) return;
      const lowest = framings.nation.scale * 0.85;
      const highest = framings.county.scale * 22;
      flyTo({
        ...current,
        scale: Math.max(lowest, Math.min(highest, current.scale * factor)),
      });
    },
    [flyTo, framings],
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
            The map needs JavaScript to draw. The ranking beside it carries the same
            figures, and every place links to its own page.
          </p>
        </noscript>
      </div>
    );
  }

  const shown = level === "county" ? "counties" : "municipalities";
  const drawnHere = layers ? layers[level].length : 0;
  // The focus treatment runs only while something is held and the reader has not asked
  // for less motion; drawing it while dragging would blur 564 paths every frame.
  // Whether the map should be pulling focus. The layers it drives are always in the
  // document and change only their opacity and blur, so CSS carries them in and out —
  // an instant vignette reads as a light switch, where a lens takes a moment to find
  // its subject.
  const focusing =
    active !== null && drag.current === null && flight.current === null;
  // Independent of `focusing`: the raised region and its shadow belong to the rise,
  // which has its own easing, and should not wait on the focus to arrive.
  const sharp =
    active === null
      ? null
      : (drawn.detail.find((shape) => shape.id === active) ?? null);
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
    centre && centre.level === "county" && layers
      ? (layers.county.find((outline) => outline.id === centre.id) ?? null)
      : null;
  const withFigures = ramp.observed.length;

  return (
    <figure className="globe">
      {/* The frame and its controls are one object: the controls float over the map
          rather than sitting under it, so the map is the whole panel and the buttons
          are where a reader's hand already is. */}
      <div className="globe-stage">
        <svg
          ref={frame}
          viewBox={`0 0 ${width} ${height}`}
          className="globe-frame"
          role="img"
          aria-label={
            describe ??
            `New Jersey on a map of the United States, showing ${shown} colored by ` +
              `${metricLabel}. The one under the crosshair rises with its own figure. ` +
              `The ranking beside the map carries the same figures.`
          }
          onPointerDown={(event) => {
            if (glide.current !== null) cancelAnimationFrame(glide.current);
            glide.current = null;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              vx: 0,
              vy: 0,
              at: event.timeStamp,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const box = event.currentTarget.getBoundingClientRect();
            // The SVG is scaled to its box, so a pixel on screen is not a unit in the
            // viewBox. Without this the map drifts from the cursor on a narrow screen.
            const perPixel = width / box.width;
            const dx = (event.clientX - drag.current.x) * perPixel;
            const dy = (event.clientY - drag.current.y) * perPixel;
            const dt = Math.max(1, event.timeStamp - drag.current.at);
            move(dx, dy);
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
            const thrown = drag.current;
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            coast(thrown);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onWheel={(event) => {
            // Only with a modifier held. A bare wheel over the map is the reader scrolling
            // the page past it, and swallowing that traps them on a tall map.
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            zoom(Math.pow(0.999, -event.deltaY));
          }}
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
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="url(#globe-far)"
              />
            </mask>
          </defs>

          <g className="globe-ground">
            {drawn.ground.map((shape) => (
              <path
                key={shape.id}
                d={shape.base}
                className={shape.id === "NJ" ? "with-figures" : undefined}
              />
            ))}
          </g>
          <g
            id="globe-detail-layer"
            className={focusing ? "globe-detail soft" : "globe-detail"}
          >
            {drawn.detail.map((shape) => {
              const fill = fillFor(shape.id);
              if (fill === null) {
                // No figure here: it joins the ground rather than becoming a dark class
                // of its own, which left the state looking moth-eaten at municipal zoom.
                return (
                  <path
                    key={shape.id}
                    className="globe-absent"
                    d={shape.base}
                  />
                );
              }
              const on = shape.id === active;
              return (
                <g
                  key={shape.id}
                  className={on ? "globe-region on" : "globe-region"}
                >
                  {shape.walls && (
                    <path className="wall" d={shape.walls} fill={fill} />
                  )}
                  <path className="top" d={shape.top} fill={fill} />
                </g>
              );
            })}
          </g>
          {/* The same paths again, blurred harder and masked so they only show towards
              the edge — the far half of a depth of field. `use` instances the layer, so
              this costs one element rather than another 564. */}
          <use
            href="#globe-detail-layer"
            className={focusing ? "globe-detail-far on" : "globe-detail-far"}
            mask="url(#globe-edge)"
          />
          {/* A vignette that closes in on whatever the crosshair holds. The ground
              around it keeps its color and its shape, only quieter, so the comparison
              the whole site is built on is still there to read. */}
          <rect
            className={focusing ? "globe-vignette on" : "globe-vignette"}
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#globe-fade)"
          />
          {/* The focused region drawn again, over the softened rest and the vignette,
              so it alone stays sharp and at full color. Twice is cheaper than excluding
              it from a filtered group, and it keeps the painter's order. */}
          {sharp && (
            <g className="globe-region on globe-sharp">
              {sharp.walls && (
                <path className="wall" d={sharp.walls} fill={sharpFill} />
              )}
              <path className="top" d={sharp.top} fill={sharpFill} />
            </g>
          )}
          {/* The crosshair. Fixed at the middle of the frame: the reader moves the map
            under it rather than pointing at a place, which is what makes the map
            readable on a touch screen with no hover. */}
          {crosshair && (
            <g className="globe-crosshair" aria-hidden="true">
              <circle cx={width / 2} cy={height / 2} r={9} />
              <line
                x1={width / 2 - 16}
                y1={height / 2}
                x2={width / 2 - 11}
                y2={height / 2}
              />
              <line
                x1={width / 2 + 11}
                y1={height / 2}
                x2={width / 2 + 16}
                y2={height / 2}
              />
              <line
                x1={width / 2}
                y1={height / 2 - 16}
                x2={width / 2}
                y2={height / 2 - 11}
              />
              <line
                x1={width / 2}
                y1={height / 2 + 11}
                x2={width / 2}
                y2={height / 2 + 16}
              />
            </g>
          )}
        </svg>

        <div className="globe-controls globe-controls-jumps">
          <button type="button" onClick={() => flyTo(framings.nation)}>
            United States
          </button>
          <span className="globe-divider" aria-hidden="true" />
          <button type="button" onClick={() => flyTo(framings.county)}>
            New Jersey
          </button>
        </div>
        {centre && diveTo && (
          <button
            type="button"
            className="globe-controls globe-controls-dive"
            onClick={() => dive(diveTo)}
          >
            Jump into {centre.name}
            {centre.level === "county" ? " County" : ""}
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
        </p>
      </figcaption>
    </figure>
  );
}
