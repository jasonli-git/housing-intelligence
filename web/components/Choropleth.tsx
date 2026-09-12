/**
 * Choropleth drawn as inline SVG from our own GeoJSON — no map library, no tile server,
 * no third-party key in the render path (SPEC principle 7, local-first).
 *
 * Takes paths already projected on the server (`lib/geo.ts`), so the page does not ship
 * the GeoJSON to the browser. Presentational and hook-free; the New Jersey page's
 * explorer owns the state and passes the hovered county in.
 *
 * The ramp follows the data, not the metric. Percentage change is signed, so a diverging
 * blue-neutral-red ramp is right *when the values actually straddle zero*. When they do
 * not — NJ home values rose in all 21 counties over five years — a diverging ramp around
 * zero paints every region the same step and the map says nothing. In that case the
 * encoding falls back to the single-hue sequential ramp across the observed range, which
 * is what an all-positive magnitude wants. A rainbow is wrong for both.
 *
 * Breaks are quantiles over the observed values rather than fixed thresholds, so the map
 * separates the regions it actually contains.
 */

import type { Projected } from "@/lib/geo";
import { classIndex, quantileBreaks, sortedValues, straddlesZero } from "@/lib/scale";

type Props = {
  map: Projected;
  /** region_id -> the value shaded. Regions absent from the map render as "no data". */
  values: Map<number, number>;
  title: string;
  format: (value: number) => string;
  /** The county to outline, drawn last so no neighbour's fill covers its edge. */
  active?: number | null;
  onHover?: (id: number | null) => void;
};

const DIVERGING = [
  "var(--div-neg-2)",
  "var(--div-neg-1)",
  "var(--div-mid)",
  "var(--div-pos-1)",
  "var(--div-pos-2)",
];
const SEQUENTIAL = [
  "var(--seq-100)",
  "var(--seq-250)",
  "var(--seq-400)",
  "var(--seq-550)",
  "var(--seq-700)",
];

export function Choropleth({ map, values, title, format, active = null, onHover }: Props) {
  const observed = sortedValues(values.values());
  const diverging = straddlesZero(observed);
  const ramp = diverging ? DIVERGING : SEQUENTIAL;
  const breaks = observed.length > 4 ? quantileBreaks(observed) : [];

  const fillFor = (value: number | undefined) =>
    value === undefined || breaks.length === 0 ? "var(--surface-2)" : ramp[classIndex(value, breaks)];

  // Legend labels come from the same breaks the fills use, so they cannot drift apart.
  const steps: [string, string][] =
    breaks.length === 0
      ? []
      : ramp.map((color, index) => {
          const low = index === 0 ? observed[0] : breaks[index - 1];
          const high = index === ramp.length - 1 ? observed.at(-1)! : breaks[index];
          return [color, `${format(low)} to ${format(high)}`];
        });

  const shapes =
    active === null
      ? map.shapes
      : [...map.shapes.filter((s) => s.id !== active), ...map.shapes.filter((s) => s.id === active)];

  return (
    <figure className="map">
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        role="img"
        aria-label={`${title}. The table beside the map carries the same figures.`}
        onMouseLeave={() => onHover?.(null)}
      >
        {shapes.map((shape) => {
          const value = values.get(shape.id);
          // Built as one string, not interpolated JSX children: SVG <title> takes text
          // content only, and React warns when it receives several children.
          const tooltip = `${shape.name}: ${value === undefined ? "no data" : format(value)}`;
          return (
            // An SVG <a>, not next/link: Link renders an HTML anchor, which is invalid
            // inside <svg>. Out of the tab order, because the table beside the map links
            // every county and a keyboard reader should not pass through them twice.
            <a key={shape.id} href={`/regions/${shape.id}`} tabIndex={-1}>
              <path
                d={shape.d}
                className={shape.id === active ? "county on" : "county"}
                fill={fillFor(value)}
                onMouseEnter={() => onHover?.(shape.id)}
              >
                <title>{tooltip}</title>
              </path>
            </a>
          );
        })}
      </svg>
      <div className="legend" aria-hidden="true">
        {steps.map(([color, label]) => (
          <span key={label}>
            <i className="swatch" style={{ background: color }} />
            {label}
          </span>
        ))}
        {values.size < map.shapes.length && (
          <span>
            <i className="swatch" style={{ background: "var(--surface-2)" }} />
            no data
          </span>
        )}
      </div>
      <figcaption className="scale-note">
        {diverging
          ? "Diverging scale: values cross zero, so the midpoint is no change."
          : "Sequential scale: every county moved the same way, so a diverging ramp would show one colour."}{" "}
        Breaks are quintiles of the observed range.
      </figcaption>
    </figure>
  );
}
