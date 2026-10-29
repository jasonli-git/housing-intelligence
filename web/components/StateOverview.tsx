import { Term } from "@/components/Term";
import type { LevelReading } from "@/lib/api";
import type { ReactNode } from "react";
import { formatMetric } from "@/lib/format";
import { monthLabel } from "@/lib/periods";
import { stateOverviewFigures } from "@/lib/stateEntry";

export function StateOverview({ levels, hasNotes = false, children }: {
  levels: LevelReading[];
  hasNotes?: boolean;
  children?: ReactNode;
}) {
  // The market in three New Jersey figures (owner, 2026-10-29): the sale price, the
  // property tax the state is known for, and how many homes sold. The national mortgage
  // rate and net homes added no longer lead it.
  const { price, tax, sales } = stateOverviewFigures(levels);
  return <section id="state-overview" className="state-overview" aria-labelledby="state-overview-heading">
    <div className="state-chapter-head"><h2 id="state-overview-heading">Housing market{hasNotes && <sup className="state-note-marker"><a id="state-note-reference" className="state-note-reference" href="#state-figure-notes" aria-label="Read notes about statewide figures at the bottom of the page" title="Notes about statewide figures">†</a></sup>}</h2></div>
    <div className="state-facts">
      {price && <article><strong>{formatMetric(price.value, price.unit, price.metric_id)}</strong><Term id={price.metric_id}>Median sold-home price</Term><small>{monthLabel(price.period_start)}–{monthLabel(price.period_end)} · NJ sale records</small></article>}
      {tax && <article><strong>{formatMetric(tax.value, tax.unit, tax.metric_id)}</strong><Term id={tax.metric_id}>Effective property tax rate</Term><small>{tax.period_end.slice(0, 4)} · NJ Division of Taxation</small></article>}
      {sales && <article><strong>{formatMetric(sales.value, sales.unit, sales.metric_id)}</strong><Term id={sales.metric_id}>Homes sold</Term><small>{monthLabel(sales.period_start)}–{monthLabel(sales.period_end)} · NJ sale records</small></article>}
    </div>
    {!price && !tax && !sales && <p>Statewide overview figures are unavailable in this snapshot.</p>}
    {(price || tax || sales) && <details className="state-snapshot-limits"><summary>Scope</summary><div>
      {price && <p>Sale price covers qualifying residential sales—not the value of every home.</p>}
      {tax && <p>The effective rate is the property tax levied per $100 of a home’s market value, statewide; a town’s rate can be far higher or lower.</p>}
      {sales && <p>Homes sold counts qualifying residential sales over the whole window shown, not one year.</p>}
    </div></details>}
    {children}
  </section>;
}
