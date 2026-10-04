import type { LevelReading } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { monthLabel, periodLabel } from "@/lib/periods";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { stateOverviewFigures } from "@/lib/stateEntry";

export function StateOverview({ levels, mortgage, preliminaryYears, hasNotes = false }: {
  levels: LevelReading[];
  mortgage: { value: number; period_start: string; metric_id: string } | null;
  preliminaryYears: number[];
  hasNotes?: boolean;
}) {
  const { price, added, certified, demolished } = stateOverviewFigures(levels);
  return <section id="state-overview" className="state-overview" aria-labelledby="state-overview-heading">
    <div className="state-chapter-head"><h2 id="state-overview-heading">Statewide snapshot{hasNotes && <sup className="state-note-marker"><a id="state-note-reference" className="state-note-reference" href="#state-figure-notes" aria-label="Read notes about statewide figures at the bottom of the page" title="Notes about statewide figures">†</a></sup>}</h2></div>
    <div className="state-facts">
      {price && <article><p className="entry-kicker">Homes that sold</p><strong>{formatMetric(price.value, price.unit, price.metric_id)}</strong><FloatingMetricTerm metricId={price.metric_id} label="Median sale price" /><small>{monthLabel(price.period_start)}–{monthLabel(price.period_end)} · NJ sale records</small><p>Qualifying residential sales—not a value for every home.</p></article>}
      {mortgage && <article><p className="entry-kicker">Borrowing benchmark</p><strong>{mortgage.value.toFixed(2)}%</strong><FloatingMetricTerm metricId={mortgage.metric_id} label="30-year fixed mortgage" /><small>{periodLabel(mortgage.period_start, mortgage.metric_id)} · Freddie Mac</small><p>National average, not a local rate or a lender quote.</p></article>}
      {added && <article><p className="entry-kicker">Reported building activity</p><strong>{formatMetric(added.value, added.unit, added.metric_id)}</strong><FloatingMetricTerm metricId={added.metric_id} label="Net homes added" /><small>{periodLabel(added.period_end, added.metric_id)}{preliminaryYears.includes(Number(added.period_end.slice(0, 4))) ? " (preliminary)" : ""} · NJ construction reports</small><p>Completions minus demolitions; reporting towns only.{certified && demolished ? ` Reporting coverage: ${(certified.value * 100).toFixed(0)}% for completions, ${(demolished.value * 100).toFixed(0)}% for demolitions.` : ""}</p></article>}
    </div>
    {!price && !added && !mortgage && <p>Statewide overview figures are unavailable in this snapshot.</p>}
  </section>;
}
