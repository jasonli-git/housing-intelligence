import type { ReactNode } from "react";
import { FloatingMetricTerm } from "./FloatingMetricTerm";
import type { ProfileItem } from "@/lib/verdict";
import { AbstractField } from "./AbstractField";

export function QuietLinework() {
  return <AbstractField kind="contours" />;
}

export function QuietCheckTopics() {
  const topics = [
    {label: "Flood exposure", path: "M3 18Q7 14 11 18T19 18M3 23Q7 19 11 23T19 23M6 12V7L12 2L18 7V12"},
    {label: "Ground & water", path: "M12 2C10 6 5 11 5 15A7 7 0 0 0 19 15C19 11 14 6 12 2ZM2 25H22M5 29H19"},
    {label: "Property tax", path: "M5 2H19V28L15 25L12 28L9 25L5 28ZM9 8H15M9 13H15M9 18H13"},
  ];
  return <div className="quiet-check-topics">{topics.map((t) => <span key={t.label}><svg viewBox="0 0 24 32" fill="none" aria-hidden="true"><path d={t.path} /></svg>{t.label}</span>)}</div>;
}

export function QuietAnchor({ enabled, id, children }: { enabled: boolean; id: string; children: ReactNode }) {
  return enabled ? <div id={id}>{children}</div> : <>{children}</>;
}

export function QuietToolGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <div className="quiet-tool-group" role="group" aria-label="Your household and buying plans">
    <AbstractField kind="household" />
    <h3>Your household &amp; buying plans</h3>{children}
  </div> : <>{children}</>;
}

/** Presentation-only experiment. Native disclosures also work before hydration. */
export function QuietDisclosure({ enabled, title, note, children }: {
  enabled: boolean; title: string; note?: string; children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return <details className="quiet-disclosure">
    <summary>{title === "The local market" && <AbstractField kind="architecture" />}<span>{title}{note && <small>{note}</small>}</span><span className="quiet-plus" aria-hidden="true">+</span></summary>
    <div className="quiet-disclosure-body">{children}</div>
  </details>;
}

export function QuietProfile({ items, peers = "counties", statewide = false, allMetrics = false }: { items: ProfileItem[]; peers?: string; statewide?: boolean; allMetrics?: boolean }) {
  if (!items.length) return null;
  const primary = items.filter((item) => ["acs_median_hh_income", "acs_renter_cost_burden", "modiv_median_year_built"].includes(item.metric_id));
  const picked = allMetrics ? items : primary.length ? primary : items.slice(0, 3);
  const rest = items.filter((item) => !picked.includes(item));
  const figures = (rows: ProfileItem[], portrait = false) => <div className={`quiet-profile-grid${portrait ? " quiet-portrait-grid" : ""}`}>{rows.map((item) => <article key={item.metric_id} data-metric={item.metric_id}>
    {portrait && item.metric_id === "acs_renter_cost_burden" && /^\d+(\.\d+)?%$/.test(item.value) && <div className="quiet-portrait-dots" aria-hidden="true">
      {Array.from({length: 100}, (_, i) => <i key={i} className={i < Math.round(Number.parseFloat(item.value)) ? "filled" : undefined} />)}
    </div>}
    {portrait && item.metric_id === "modiv_median_year_built" && <svg className="quiet-portrait-house" aria-hidden="true" viewBox="0 0 240 120" fill="none">
      <path d="M5 110H235M30 110V56L88 14L146 56V110M20 63L88 14L156 63M146 110V72L188 43L229 72V110M68 110V76H99V110M43 64H61V82H43ZM111 64H129V82H111ZM171 77H193V94H171ZM71 27V8H82V19" />
    </svg>}
    <p><strong>{item.value}</strong>{item.margin && <span className="quiet-margin">{item.margin}</span>}</p>
    <FloatingMetricTerm metricId={item.metric_id} label={item.label} definition={item.definition} why={null} />
    {item.context && <small>{item.context.words}{item.context.rank && ` · ${item.context.rank.best !== undefined && item.context.rank.worst !== undefined ? `${item.context.rank.best}–${item.context.rank.worst}` : item.context.rank.value} of ${item.context.rank.of} ${peers}`}</small>}
  </article>)}</div>;
  return <section className={`quiet-profile${statewide ? " quiet-state-profile" : ""}`} aria-label={statewide ? "Additional statewide measures" : "Housing profile"}>
    <span className="quiet-label">{statewide ? "More statewide measures" : "Housing, at a glance"}</span>
    {figures(picked, true)}
    {rest.length > 0 && <details className="quiet-profile-more"><summary>{statewide ? "More state measures" : "More about the housing here"} <span aria-hidden="true">↗</span></summary>{figures(rest)}</details>}
  </section>;
}
