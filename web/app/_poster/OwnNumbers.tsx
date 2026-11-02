"use client";

import Link from "next/link";
import { useState } from "react";

import { ownershipInputs, type PublishedCosts } from "@/lib/budgetScenario";
import { DOWN_PAYMENTS } from "@/lib/cost";
import { eachMonth, upFront } from "@/lib/ownership";
import styles from "./poster.module.css";

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
/** A typed amount, or null while the box is empty or not yet a number. */
const amount = (text: string) => { const n = Number(text.replace(/[$,\s]/g, "")); return text.trim() && Number.isFinite(n) && n >= 0 ? n : null; };
const COLORS: Record<string, string> = { mortgage: "var(--series-1)", tax: "var(--series-2)", insurance: "var(--series-3)", utilities: "var(--text-secondary)", upkeep: "var(--tick)", pmi: "var(--series-4, #a78bfa)" };

function Field({ id, label, value, placeholder, onChange, prefix }: { id: string; label: string; value: string; placeholder: string; onChange: (text: string) => void; prefix?: string }) {
  return <label className={styles.field} htmlFor={id}><span>{label}</span>
    <div>{prefix && <i>{prefix}</i>}<input id={id} inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>
  </label>;
}

/** The monthly estimate with a reader's own figures: empty boxes keep the published ones. */
export function OwnNumbers({ source, income, guideHref }: { source: PublishedCosts; income: number | null; guideHref: string }) {
  const [fields, setFields] = useState({ price: "", rate: "", tax: "", rent: "", income: "" });
  const [down, setDown] = useState(20);
  const set = (key: keyof typeof fields) => (text: string) => setFields({ ...fields, [key]: text });
  const reset = () => { setFields({ price: "", rate: "", tax: "", rent: "", income: "" }); setDown(20); };

  const typedRate = amount(fields.rate);
  const input = ownershipInputs(source, { downPct: down, ratePct: typedRate !== null && typedRate <= 30 ? typedRate : source.ratePct }, {
    price: amount(fields.price) || source.price,
    taxYear: amount(fields.tax) ?? source.taxYear,
    rentMonth: amount(fields.rent) ?? source.rentMonth,
  });
  const month = eachMonth(input);
  const cash = upFront(input);
  const rent = input.rentMonth;
  const lines = month.lines.filter((line) => (line.value ?? 0) > 0);
  const yearly = amount(fields.income) || income;
  const share = yearly ? (month.total * 12 / yearly) * 100 : null;
  const edited = down !== 20 || Object.values(fields).some(Boolean);

  return <div className={styles.ownNumbers}>
    <form onSubmit={(event) => event.preventDefault()}>
      <Field id="own-price" label="Home price" prefix="$" value={fields.price} placeholder={Math.round(source.price).toLocaleString("en-US")} onChange={set("price")} />
      <fieldset><legend>Down payment</legend><div className={styles.chips}>{DOWN_PAYMENTS.map((pct) => <button key={pct} type="button" aria-pressed={down === pct} onClick={() => setDown(pct)}>{pct}%</button>)}</div></fieldset>
      <Field id="own-rate" label="Mortgage rate, %" value={fields.rate} placeholder={source.ratePct.toFixed(2)} onChange={set("rate")} />
      <Field id="own-tax" label="Property tax a year" prefix="$" value={fields.tax} placeholder={source.taxYear ? Math.round(source.taxYear).toLocaleString("en-US") : "Unknown"} onChange={set("tax")} />
      <Field id="own-rent" label="Rent you’d pay instead" prefix="$" value={fields.rent} placeholder={source.rentMonth ? Math.round(source.rentMonth).toLocaleString("en-US") : "Unknown"} onChange={set("rent")} />
      <Field id="own-income" label="Household income a year" prefix="$" value={fields.income} placeholder={income ? Math.round(income).toLocaleString("en-US") : "Optional"} onChange={set("income")} />
    </form>
    <div className={styles.ownResult} aria-live="polite">
      <p><strong>{dollars(month.total)}</strong> a month to own</p>
      <div className={styles.stack}>{lines.map((line) => <i key={line.key} title={`${line.label}: ${dollars(line.value ?? 0)}`} style={{ flexGrow: line.value ?? 0, background: COLORS[line.key] ?? "var(--text-muted)" }} />)}</div>
      <ul className={styles.key}>{lines.map((line) => <li key={line.key}><i style={{ background: COLORS[line.key] ?? "var(--text-muted)" }} />{line.label} {dollars(line.value ?? 0)}</li>)}</ul>
      <dl>
        {rent !== null && <div><dt>{month.total >= rent ? "More than renting" : "Less than renting"}</dt><dd>{dollars(Math.abs(month.total - rent))}</dd></div>}
        {share !== null && <div><dt>Of income</dt><dd>{share.toFixed(0)}%</dd></div>}
        <div><dt>Cash up front</dt><dd>{dollars(cash.low)}–{dollars(cash.high)}</dd></div>
      </dl>
      {month.missing.length > 0 && <p className={styles.caption}>Not counted: {month.missing.join(", ").toLowerCase()}.</p>}
      {typedRate !== null && typedRate > 30 && <p className={styles.caption}>That rate looks wrong, so the published rate is used.</p>}
      <p className={styles.caption}>An estimate, not a quote. Tax stays at the town’s typical bill unless you change it.</p>
      <p className={styles.actions}>{edited && <button type="button" onClick={reset}>Reset</button>}<Link href={guideHref}>Check it in the Buyer’s guide</Link></p>
    </div>
  </div>;
}
