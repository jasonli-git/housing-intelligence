import { annualHomePriceChange, type TrendPoint } from "./nationalBenchmarks";

/**
 * The home page's national scoreboard (Milestone 57): eight small tiles of what the US
 * housing market is doing, each compared with the same period a year earlier.
 *
 * Pure, so the comparisons are tested without the API. A tile without an exact
 * year-earlier reading shows its value and no change, rather than comparing against the
 * nearest month it can find (the rule `annualHomePriceChange` already keeps).
 */

type Reading = { value: number; period_start: string; period_end: string };

/** Whether a rise makes the market easier or harder for someone buying or renting. */
export type Easier = "up" | "down" | null;
export type Tone = "easier" | "harder" | "flat" | "neutral";

export type ScoreTile = {
  id: string;
  /** The metric the definition and history come from. */
  metricId: string;
  label: string;
  value: string;
  /** How the change reads: "+5.4%", "−1 day", "+0.3 pts". */
  change: string | null;
  direction: "up" | "down" | "flat" | null;
  tone: Tone;
  /** A spoken sentence for the tile, since the arrow and colour carry meaning. */
  summary: string;
  period: string;
  source: { name: string; href: string };
  /** Two years of what the value shows, for the tile's faint line. */
  trend: TrendPoint[];
  /** How the history's scale is written. */
  unit: "percent" | "count" | "days" | "months" | "index";
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

function weekLabel(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

function sorted(readings: readonly Reading[]): Reading[] {
  return readings
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.period_start.localeCompare(b.period_start));
}

function yearEarlier(date: string): string {
  return `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
}

/** The same month a year before the latest, or null: never the closest one. */
function sameMonthLastYear(readings: readonly Reading[]): [Reading, Reading] | null {
  const latest = readings.at(-1);
  if (!latest) return null;
  const baseline = readings.find((r) => r.period_start === yearEarlier(latest.period_start));
  return baseline ? [baseline, latest] : null;
}

/**
 * The survey week a year before the latest: a weekly series reports on a weekday, so
 * the date moves by a day or two each year. Within three days of 52 weeks back, or null.
 */
function sameWeekLastYear(readings: readonly Reading[]): [Reading, Reading] | null {
  const latest = readings.at(-1);
  if (!latest) return null;
  const target = Date.parse(latest.period_start) - 364 * 86_400_000;
  const baseline = readings.find((r) => Math.abs(Date.parse(r.period_start) - target) <= 3 * 86_400_000);
  return baseline ? [baseline, latest] : null;
}

/** Monthly annual changes in percent, one per month that has a year-earlier reading. */
export function annualChanges(readings: readonly Reading[]): Reading[] {
  const byDate = new Map(readings.map((r) => [r.period_start, r]));
  return sorted(readings).flatMap((r) => {
    const change = annualHomePriceChange([byDate.get(yearEarlier(r.period_start))!, r].filter(Boolean));
    return change ? [{ value: change.pct_change, period_start: r.period_start, period_end: r.period_end }] : [];
  });
}

/** The last two years of a series, gaps of more than a period kept as gaps. */
function trendOf(readings: readonly Reading[], weekly = false): TrendPoint[] {
  const latest = readings.at(-1);
  if (!latest) return [];
  const from = yearEarlier(yearEarlier(latest.period_start));
  const points: TrendPoint[] = [];
  for (const r of readings.filter((r) => r.period_start >= from)) {
    const previous = points.at(-1);
    if (previous && (Date.parse(r.period_start) - Date.parse(previous.date)) / 86_400_000 > (weekly ? 8 : 32)) {
      points.push({ date: r.period_start, value: null });
    }
    points.push({ date: r.period_start, value: r.value });
  }
  return points;
}

const MINUS = "−";

function signed(n: number, digits: number): string {
  const text = Math.abs(n).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${n > 0 ? "+" : MINUS}${text}`;
}

/** 1,161,615 → "1.16M"; 61 → "61". */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString("en-US");
}

function toneOf(delta: number, easier: Easier, flatBelow: number): Pick<ScoreTile, "direction" | "tone"> {
  if (Math.abs(delta) < flatBelow) return { direction: "flat", tone: easier ? "flat" : "neutral" };
  const direction = delta > 0 ? "up" : "down";
  if (!easier) return { direction, tone: "neutral" };
  return { direction, tone: direction === easier ? "easier" : "harder" };
}

const READS = { easier: "easier for buyers and renters", harder: "harder for buyers and renters" };

function sentence(label: string, value: string, change: string | null, tone: Tone, period: string): string {
  if (!change) return `${label}: ${value}, ${period}. No comparable reading a year earlier.`;
  const reading = tone === "easier" || tone === "harder" ? `, ${READS[tone]}` : "";
  return `${label}: ${value}, ${period}. ${change.replace(MINUS, "minus ")} from a year earlier${reading}.`;
}

type Spec = {
  id: string;
  metricId: string;
  label: string;
  source: ScoreTile["source"];
  unit: ScoreTile["unit"];
  easier: Easier;
};

function tile(spec: Spec, value: string, delta: { text: string; n: number; flatBelow: number } | null, period: string, trend: TrendPoint[]): ScoreTile {
  const { direction, tone } = delta ? toneOf(delta.n, spec.easier, delta.flatBelow) : { direction: null, tone: "neutral" as Tone };
  return {
    id: spec.id, metricId: spec.metricId, label: spec.label, value, period, trend, unit: spec.unit, source: spec.source,
    change: delta?.text ?? null, direction, tone,
    summary: sentence(spec.label, value, delta?.text ?? null, tone, period),
  };
}

const FRED = (series: string) => `https://fred.stlouisfed.org/series/${series}`;

export type ScoreSeries = {
  rate: { metricId: string; readings: readonly Reading[] } | null;
  hpi: readonly Reading[];
  listings: readonly Reading[];
  priceCutShare: readonly Reading[];
  daysOnMarket: readonly Reading[];
  rentCpi: readonly Reading[];
  starts: readonly Reading[];
  newHomeSupply: readonly Reading[];
};

/** Up to eight tiles, in reading order; a series with no readings drops its tile. */
export function scoreboard(series: ScoreSeries): ScoreTile[] {
  const tiles: ScoreTile[] = [];

  if (series.rate) {
    const weekly = series.rate.metricId === "mortgage_rate_30y_weekly";
    const r = sorted(series.rate.readings);
    const pair = weekly ? sameWeekLastYear(r) : sameMonthLastYear(r);
    const latest = r.at(-1);
    if (latest) {
      const d = pair ? latest.value - pair[0].value : null;
      tiles.push(tile(
        { id: "rate", metricId: series.rate.metricId, label: "Mortgage rate", unit: "percent", easier: "down", source: { name: "Freddie Mac", href: "https://www.freddiemac.com/pmms" } },
        `${latest.value.toFixed(2)}%`,
        d === null ? null : { text: `${signed(d, 2)} pts`, n: d, flatBelow: 0.005 },
        weekly ? weekLabel(latest.period_start) : monthLabel(latest.period_start),
        trendOf(r, weekly),
      ));
    }
  }

  const percentChange = (spec: Spec, readings: readonly Reading[]) => {
    const yoy = annualChanges(readings);
    const latest = yoy.at(-1);
    if (!latest) return;
    const pair = sameMonthLastYear(yoy);
    const d = pair ? latest.value - pair[0].value : null;
    tiles.push(tile(spec, `${signed(latest.value, 1)}%`,
      d === null ? null : { text: `${signed(d, 1)} pts`, n: d, flatBelow: 0.05 },
      monthLabel(latest.period_start), trendOf(yoy)));
  };

  percentChange({ id: "prices", metricId: "fhfa_hpi_us_monthly", label: "Home prices y/y", unit: "percent", easier: "down", source: { name: "FHFA", href: "https://www.fhfa.gov/data/hpi/datasets?tab=monthly-data" } }, series.hpi);

  const level = (spec: Spec, readings: readonly Reading[], show: (n: number) => string, change: (now: number, then: number) => { text: string; n: number; flatBelow: number }) => {
    const r = sorted(readings);
    const latest = r.at(-1);
    if (!latest) return;
    const pair = sameMonthLastYear(r);
    tiles.push(tile(spec, show(latest.value), pair ? change(latest.value, pair[0].value) : null, monthLabel(latest.period_start), trendOf(r)));
  };
  const pct = (now: number, then: number) => {
    const n = then > 0 ? (now / then - 1) * 100 : 0;
    return { text: `${signed(n, 1)}%`, n, flatBelow: 0.05 };
  };

  level({ id: "listings", metricId: "realtor_active_listings", label: "Homes for sale", unit: "count", easier: "up", source: { name: "Realtor.com", href: FRED("ACTLISCOUUS") } },
    series.listings, compact, pct);
  level({ id: "days", metricId: "realtor_median_days_on_market", label: "Days on market", unit: "days", easier: "up", source: { name: "Realtor.com", href: FRED("MEDDAYONMARUS") } },
    series.daysOnMarket, (n) => `${Math.round(n)} days`, (now, then) => {
      const n = Math.round(now) - Math.round(then);
      return { text: `${signed(n, 0)} ${Math.abs(n) === 1 ? "day" : "days"}`, n, flatBelow: 0.5 };
    });
  level({ id: "cuts", metricId: "realtor_price_reduced_share", label: "Price cuts", unit: "percent", easier: null, source: { name: "Realtor.com", href: FRED("PRIREDCOUUS") } },
    series.priceCutShare, (n) => `${n.toFixed(1)}%`, (now, then) => ({ text: `${signed(now - then, 1)} pts`, n: now - then, flatBelow: 0.05 }));

  percentChange({ id: "rent", metricId: "cpi_rent_primary_residence", label: "Rent inflation", unit: "percent", easier: "down", source: { name: "BLS", href: FRED("CUSR0000SEHA") } }, series.rentCpi);

  level({ id: "starts", metricId: "housing_starts_saar", label: "Housing starts", unit: "count", easier: "up", source: { name: "Census", href: FRED("HOUST") } },
    series.starts, (n) => `${compact(n)}/yr`, pct);
  level({ id: "supply", metricId: "new_home_months_supply", label: "New-home supply", unit: "months", easier: "up", source: { name: "Census", href: FRED("MSACSR") } },
    series.newHomeSupply, (n) => `${n.toFixed(1)} mo`, (now, then) => ({ text: `${signed(now - then, 1)} mo`, n: now - then, flatBelow: 0.05 }));

  return tiles;
}

/**
 * Two or three plain sentences the tiles support, written by rule rather than by a model
 * (Milestone 57): what changed from a year earlier, in the tiles' own figures. Says only
 * what moved and by how much, never why, and never what comes next, so it needs none of
 * the reading pipeline's gates. A sentence whose tiles lack a year-earlier change is left
 * out rather than written around the gap.
 */
export function marketSummary(tiles: readonly ScoreTile[]): string[] {
  const by = new Map(tiles.map((t) => [t.id, t]));
  const moved = (t: ScoreTile | undefined): t is ScoreTile & { change: string } => Boolean(t?.change);
  const amount = (t: ScoreTile & { change: string }) => t.change.replace(/^[+−]/, "").replace(/ pts$/, " points");
  const sentences: string[] = [];

  const rate = by.get("rate");
  if (moved(rate)) {
    sentences.push(rate.direction === "flat"
      ? `The 30-year mortgage rate is ${rate.value}, where it was a year ago.`
      : `The 30-year mortgage rate is ${rate.value}, ${amount(rate)} ${rate.direction === "up" ? "higher" : "lower"} than a year ago.`);
  }

  const listings = by.get("listings"), days = by.get("days");
  if (moved(listings)) {
    const more = listings.direction === "up" ? "More" : listings.direction === "down" ? "Fewer" : "About as many";
    const pct = listings.direction === "flat" ? "" : ` (${listings.change})`;
    const sit = moved(days)
      ? days.direction === "flat" ? `, and they sell about as fast (${days.value} on the market)`
        : `, and they sell ${amount(days)} ${days.direction === "up" ? "slower" : "faster"} (${days.value} on the market)`
      : "";
    sentences.push(`${more} homes are for sale than a year ago${pct}${sit}.`);
  }

  const starts = by.get("starts"), supply = by.get("supply");
  if (moved(starts)) {
    const verb = starts.direction === "up" ? `started ${amount(starts)} more homes` : starts.direction === "down" ? `started ${amount(starts)} fewer homes` : "started about as many homes";
    const stock = supply ? `, with ${supply.value.replace(" mo", " months")}' supply of new homes for sale` : "";
    sentences.push(`Builders ${verb} than a year ago${stock}.`);
  }

  const rent = by.get("rent");
  if (moved(rent)) {
    const pace = rent.direction === "down" ? "slower" : rent.direction === "up" ? "faster" : "the same pace";
    sentences.push(rent.direction === "flat"
      ? `Rents are rising ${rent.value.replace(/^\+/, "")} a year, at the same pace as a year ago.`
      : `Rents are rising ${rent.value.replace(/^\+/, "")} a year, ${amount(rent)} ${pace} than a year ago.`);
  }
  return sentences;
}
