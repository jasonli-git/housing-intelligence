/**
 * The arithmetic behind the map and the charts, separated from the components that
 * draw with it.
 *
 * Not a refactor for tidiness: the choropleth once shipped as a single flat colour
 * because a diverging ramp was centred on zero while every value was positive, and
 * nothing could catch that without being able to call the classifier directly. These
 * functions are pure, so `lib/scale.test.ts` exercises them without a DOM.
 */

/** Ascending copy. Every function below expects its input already sorted. */
export function sortedValues(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Whether a diverging ramp is the right encoding.
 *
 * Signed data alone does not justify diverging — the values have to actually cross
 * zero. When they do not, a ramp centred on zero puts every region in one class.
 */
export function straddlesZero(sorted: number[]): boolean {
  return sorted.length > 0 && sorted[0] < 0 && sorted[sorted.length - 1] > 0;
}

/** Quintile edges: four cut points giving five classes, linearly interpolated. */
export function quantileBreaks(sorted: number[]): number[] {
  return [0.2, 0.4, 0.6, 0.8].map((q) => {
    const position = q * (sorted.length - 1);
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  });
}

/** Which class a value falls in. Breaks are upper-inclusive: `value <= break`. */
export function classIndex(value: number, breaks: number[]): number {
  let index = 0;
  while (index < breaks.length && value > breaks[index]) index += 1;
  return index;
}

export type Scale = (value: number) => number;

/** Linear map from a data domain onto a pixel range. A zero-width domain maps flat. */
export function linearScale(
  [domainMin, domainMax]: [number, number],
  [rangeMin, rangeMax]: [number, number],
): Scale {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

/**
 * A y-domain with 8% headroom, deliberately not anchored at zero.
 *
 * An index hovering near 400 does not want 0 on the axis; forcing it flattens the
 * shape the chart exists to show. The fallbacks handle a flat series and an all-zero
 * series, either of which would otherwise give a zero-height plot.
 */
export function paddedExtent(values: number[]): [number, number] {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low) * 0.08 || Math.abs(high) * 0.08 || 1;
  return [low - pad, high + pad];
}

/** Index of the entry closest to `target` — the chart's hover hit-test. */
export function nearestIndex(values: number[], target: number): number {
  let nearest = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (Math.abs(values[index] - target) < Math.abs(values[nearest] - target)) {
      nearest = index;
    }
  }
  return nearest;
}
