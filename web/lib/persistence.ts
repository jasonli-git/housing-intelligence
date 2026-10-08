import type { Persistence, PersistenceEpisode } from "@/lib/api";

/** "15% above" / "4% below", whole percent: the page's register, not the packet's. */
export function againstUsual(pct: number): string {
  const whole = Math.round(Math.abs(pct));
  if (whole === 0) return "at";
  return `${whole}% ${pct > 0 ? "above" : "below"}`;
}

export function suffix(n: number): string {
  const two = n % 100;
  if (two >= 11 && two <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

/** Where the latest year sits among all the years, as a range where income's margin
 *  allows more than one place. */
export function placeAmongYears(p: Persistence): string | null {
  if (p.rank_best === null || p.rank_worst === null) return null;
  if (p.rank_best === p.rank_worst) return `the ${suffix(p.rank_best)} highest of ${p.years} years`;
  return `between the ${suffix(p.rank_best)} and ${suffix(p.rank_worst)} highest of ${p.years} years`;
}

/** The headline sentence: how far today sits from the usual level, and where it ranks. */
export function leadSentence(p: Persistence, name: string): string | null {
  if (p.vs_median === null) return null;
  const place = placeAmongYears(p);
  return (
    `In ${p.last_year}, home prices against household income in ${name} were ` +
    `${againstUsual(p.vs_median)} their usual level since ${p.first_year}` +
    (place ? ` — ${place}.` : ".")
  );
}

function spell(e: PersistenceEpisode): string {
  const span = e.start === e.end ? `${e.start}` : `${e.start}–${e.end}`;
  const length = `${e.years} ${e.years === 1 ? "year" : "years"}`;
  const back =
    e.back_to_median !== null
      ? `back at its usual level by ${e.back_to_median}`
      : "not back at its usual level since";
  return `${span} (${length}, highest in ${e.peak_year} at ${againstUsual(e.peak_vs_median)}; ${back})`;
}

/** Earlier spells this high, or that there were none. */
export function spellsSentence(p: Persistence): string | null {
  if (p.vs_median === null) return null;
  if (!p.episodes.length) return `No earlier year since ${p.first_year} was this high.`;
  const lead = p.episodes.length === 1 ? "The one earlier time this high was" : "Earlier times this high:";
  return `${lead} ${p.episodes.map(spell).join("; ")}.`;
}

