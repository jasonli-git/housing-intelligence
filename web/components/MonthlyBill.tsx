"use client";
import { Glossed } from "@/components/Glossed";
import { useState, type CSSProperties } from "react";
import type { Month } from "@/lib/ownership";
import { formatValue } from "@/lib/format";
import { DEFAULT_DOWN } from "@/lib/cost";

/** Uses the existing engine. Layers are monthly cash, not all money spent. */
export function MonthlyBill({ current, baseline }: { current: Month; baseline: Month }) {
  const [selected, setSelected] = useState("mortgage");
  const line = current.lines.find(l => l.key === selected) ?? current.lines[0];
  const money = (value: number) => formatValue(value, "usd");
  const basis = (key: string, source: string) => key === "mortgage" ? "Calculated from price, down payment and mortgage rate."
    : source === "reader" ? "Your input." : source === "thumb" ? "An upkeep allowance, not a quote."
    : source === "range" ? "An estimated range, not a quote." : source === "rule" ? "Calculated using the stated financing rules." : "Based on the published area figure, not this home’s bill.";
  return <section className="monthly-bill" aria-label="Build the monthly bill">
    <div className="bill-head"><div><h3>Build the monthly bill</h3><p>Use the fields below. Every layer updates with your numbers.</p></div><div><strong>{money(current.total)}<small>/ month{current.missing.length > 0 && " · incomplete"}</small></strong><small>Starting estimate: {money(baseline.total)} · {DEFAULT_DOWN}% down{baseline.missing.length > 0 && " · incomplete"}</small></div></div>
    <div className="bill-layout"><div className="bill-stack" role="group" aria-label="Monthly cost layers">
      {current.lines.map(l => <button type="button" key={l.key} data-cost={l.key} aria-pressed={selected === l.key} onClick={() => setSelected(l.key)} style={{ "--bill-share": `${current.total > 0 ? ((l.value ?? 0) / current.total) * 100 : 0}%` } as CSSProperties}>
        <span>{l.label}</span><b>{l.value === null ? l.conditional ? "Add if needed" : "Missing" : money(l.value)}</b>
      </button>)}
    </div><div className="bill-reading"><h4><Glossed text={line.label} /></h4><p>{line.value === null ? line.conditional ? "Not included unless it applies. Enter your quote below." : "No figure supplied. Add yours below to complete this part." : basis(line.key, line.basis)}</p>
      <dl><div><dt>Money spent</dt><dd>{money(current.gone)}</dd></div><div><dt>Principal into the home</dt><dd>{money(current.principal)}</dd></div></dl>
      <p>Principal leaves your account too, but pays down the loan. These are the first month’s amounts.</p>
      {current.missing.length > 0 && <p>Still missing: {current.missing.join(", ")}. Missing is not zero.</p>}
      <small>Layers show shares of included monthly cash. Upfront costs and what your down payment could earn are separate.</small>
    </div></div>
  </section>;
}
