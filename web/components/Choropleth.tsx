/**
 * Choropleth drawn as inline SVG from our own GeoJSON — no map library, no tile server,
 * no third-party key in the render path (SPEC principle 7, local-first).
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

import type { Feature, FeatureCollection } from "@/lib/api";
import { formatChange } from "@/lib/format";
import { classIndex, quantileBreaks, sortedValues, straddlesZero } from "@/lib/scale";

type Props = {
  geo: FeatureCollection;
  /** region_id -> percentage change. Regions absent from the map render as "no data". */
  values: Map<number, number>;
  title: string;
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

const WIDTH = 620;
const HEIGHT = 680;

function rings(feature: Feature): number[][][] {
  const { type, coordinates } = feature.geometry;
  // GeoJSON gives Polygon as ring[] and MultiPolygon as polygon[]; flatten to rings.
  // ST_SimplifyPreserveTopology can turn a single-part MultiPolygon into a Polygon, so
  // both shapes genuinely occur in the same response.
  return type === "Polygon"
    ? (coordinates as number[][][])
    : (coordinates as number[][][][]).flat();
}

export function Choropleth({ geo, values, title }: Props) {
  const observed = sortedValues(values.values());
  const diverging = straddlesZero(observed);
  const ramp = diverging ? DIVERGING : SEQUENTIAL;
  const breaks = observed.length > 4 ? quantileBreaks(observed) : [];

  const fillFor = (pct: number | undefined) =>
    pct === undefined || breaks.length === 0
      ? "var(--surface-2)"
      : ramp[classIndex(pct, breaks)];

  const all = geo.features.flatMap((f) => rings(f).flat());
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];

  // Equirectangular with a cosine correction for the state's mid-latitude. Adequate for
  // one state; a real projection would matter across the country.
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonSpan = (maxLon - minLon) * Math.cos(midLat);
  const latSpan = maxLat - minLat;
  const scale = Math.min(WIDTH / lonSpan, HEIGHT / latSpan);
  const offsetX = (WIDTH - lonSpan * scale) / 2;
  const offsetY = (HEIGHT - latSpan * scale) / 2;

  const project = ([lon, lat]: number[]): [number, number] => [
    (lon - minLon) * Math.cos(midLat) * scale + offsetX,
    (maxLat - lat) * scale + offsetY,
  ];

  const path = (feature: Feature) =>
    rings(feature)
      .map(
        (ring) =>
          "M" +
          ring
            .map(project)
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join("L") +
          "Z",
      )
      .join(" ");

  // Legend labels come from the same breaks the fills use, so they cannot drift apart.
  const steps: [string, string][] = ramp.map((color, index) => {
    const low = index === 0 ? observed[0] : breaks[index - 1];
    const high = index === ramp.length - 1 ? observed.at(-1)! : breaks[index];
    return [color, `${formatChange(low)} to ${formatChange(high)}`];
  });

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="muted" style={{ marginBottom: "0.5rem" }}>
        {title}
      </figcaption>
      <div className="legend" aria-hidden="true">
        {steps.map(([color, label]) => (
          <span key={label}>
            <i className="swatch" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span>
          <i
            className="swatch"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          />
          no data
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", maxWidth: `${WIDTH}px` }}
        role="img"
        aria-label={`${title}. Values are listed in the table below.`}
      >
        {geo.features.map((feature) => {
          const pct = values.get(feature.properties.region_id);
          // Built as one string, not interpolated JSX children: SVG <title> takes
          // text content only, and React warns when it receives several children
          // because it cannot join them itself.
          const tooltip = `${feature.properties.name}: ${
            pct === undefined ? "no data" : formatChange(pct)
          }`;
          return (
            // An SVG <a>, not next/link: Link renders an HTML anchor, which is
            // invalid inside <svg>. The browser relocates it and React reports a
            // hydration mismatch. SVG has its own anchor element for exactly this.
            <a
              key={feature.properties.region_id}
              href={`/regions/${feature.properties.region_id}`}
            >
              <path
                d={path(feature)}
                fill={fillFor(pct)}
                // 1px surface-coloured stroke separates adjacent fills so two similar
                // steps never read as one shape.
                stroke="var(--surface-1)"
                strokeWidth={1}
              >
                <title>{tooltip}</title>
              </path>
            </a>
          );
        })}
      </svg>
      <p className="muted" style={{ marginTop: "0.35rem" }}>
        {diverging
          ? "Diverging scale: values cross zero, so the midpoint is no change."
          : "Sequential scale: every value shares a sign, so a diverging ramp would show one colour."}{" "}
        Breaks are quintiles of the observed range. Click a region for its detail page.
      </p>
    </figure>
  );
}
