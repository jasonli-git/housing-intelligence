"use client";

/**
 * Affordable housing records (#497): pick a town, see the properties on record there.
 * Works like the Property tax lookup — one place in, its records out — over the same
 * statewide inventory Housing help used to search as one long list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Glossed } from "@/components/Glossed";
import { addressCase } from "@/lib/parcels";
import { contractsFor, reportedEnds, soonAfterSnapshot, type AffordableHousing as HousingData, type HousingRecord } from "@/lib/affordableHousing";

export type LookupTown = { id: number; name: string; county: string; countyId: number | null };

const KINDS = [
  { key: "all", label: "All" },
  { key: "municipal_project", label: "Town-reported" },
  { key: "lihtc_property", label: "Tax credit" },
  { key: "hud_property", label: "HUD-assisted" },
] as const;
const TAG: Record<string, string> = { municipal_project: "Town-reported", lihtc_property: "Tax credit", hud_property: "HUD-assisted" };
const PROPERTY_KINDS = new Set(["municipal_project", "lihtc_property", "hud_property"]);
const PAGE = 12;
const caps = (t: string) => (t === t.toUpperCase() ? addressCase(t) : t);
const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The three lists often name the same building — a town's own report, a tax-credit record
 * and a HUD contract — so a town's records are grouped into buildings before they are
 * counted or shown. Two records on different lists are one building when their names
 * match once record numbers, filler words and punctuation are set aside (phases kept:
 * "Elm Court II" is its own building), or their street addresses match. Two records on
 * the same list merge only when they also report the same number of homes: the same
 * project filed twice, not two phases. A building's
 * homes are its largest single count, never a sum across lists.
 */
const nameKey = (name: string | null | undefined) => (name ?? "").toLowerCase()
  .replace(/#\s*\d+/g, " ")
  .replace(/\b(the|apartments?|apts?|homes|housing|senior|residences?|inc|llc|lp)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const STREET: Record<string, string> = { street: "st", avenue: "ave", road: "rd", drive: "dr", circle: "cir", lane: "ln", boulevard: "blvd", place: "pl", court: "ct" };
const addressKey = (address: string | null | undefined) => {
  const words = (address ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => STREET[w] ?? w);
  return words.length >= 2 && /^\d/.test(words[0]) ? words.join(" ") : "";
};
export type Building = { key: string; records: HousingRecord[]; units: number | null; lead: HousingRecord };
export function buildings(records: HousingRecord[]): Building[] {
  const parent = records.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  // The first record of each list under each key; a record joins another list's record.
  const seen = new Map<string, Map<string, number>>();
  records.forEach((r, i) => {
    for (const key of [nameKey(r.payload.name) && `n:${nameKey(r.payload.name)}`, addressKey(r.payload.address) && `a:${addressKey(r.payload.address)}`]) {
      if (!key) continue;
      const byKind = seen.get(key) ?? new Map<string, number>();
      for (const [k, j] of byKind) if (k !== r.kind || records[j].payload.units === r.payload.units) parent[find(i)] = find(j);
      if (!byKind.has(r.kind)) byKind.set(r.kind, i);
      seen.set(key, byKind);
    }
  });
  const groups = new Map<number, HousingRecord[]>();
  records.forEach((r, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), r]));
  const order = ["lihtc_property", "hud_property", "municipal_project"];
  return [...groups.values()].map((rs) => {
    const counts = rs.map((r) => r.payload.units).filter((u): u is number => u != null);
    const lead = [...rs].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
    return { key: `${lead.source_id}-${lead.record_id}`, records: rs, units: counts.length ? Math.max(...counts) : null, lead };
  }).sort((a, b) => (b.units ?? 0) - (a.units ?? 0));
}

/** One property as a row: what it is and where on the left, how many homes on the right. */
function Row({ b, records }: { b: Building; records: HousingRecord[] }) {
  const r = b.lead;
  const all = (k: string) => b.records.find((x) => x.kind === k);
  const p = { ...Object.assign({}, ...[...b.records].reverse().map((x) => Object.fromEntries(Object.entries(x.payload).filter(([, v]) => v != null && v !== "")))) } as HousingRecord["payload"];
  const hud = all("hud_property");
  const contract = hud ? contractsFor(hud, records)[0] : undefined;
  const lihtc = all("lihtc_property");
  const town = all("municipal_project");
  const facts = [
    lihtc && lihtc.payload.low_income_units != null ? `${lihtc.payload.low_income_units} at lower rents` : null,
    lihtc?.payload.placed_in_service ? `opened ${lihtc.payload.placed_in_service}` : null,
    town ? (town.payload.completed === true ? "finished" : town.payload.completed === false ? "not finished yet" : null) : null,
    contract?.payload.contract_end ? `HUD contract to ${month(contract.payload.contract_end)}` : null,
    (p.senior_units ?? 0) > 0 || p.targeted_seniors ? "for seniors" : null,
    p.targeted_disability || (p.special_needs_units ?? 0) > 0 ? "disability set-aside" : null,
    p.earliest_controls_end ? `rent limits end ${p.earliest_controls_end}` : null,
  ].filter(Boolean) as string[];
  const unchecked = lihtc?.payload.no_longer_monitored === true;
  return <li className="ah-row" data-kind={r.kind}>
    <div className="ah-row-main">
      <span className="ah-tags">{[...new Set(b.records.map((x) => x.kind))].map((k) => <span className="ah-tag" key={k}>{TAG[k]}</span>)}</span>
      <strong>{p.name ? caps(p.name) : "Unnamed project"}</strong>
      {p.address && <span className="ah-addr">{caps(p.address)}{p.city ? `, ${caps(p.city)}` : ""}</span>}
      {facts.length > 0 && <span className="ah-facts">{facts.join(" · ")}</span>}
      {unchecked && <span className="ah-warn">No longer checked for rent limits — ask whether they still apply</span>}
    </div>
    <div className="ah-row-side">
      <b>{b.units != null ? b.units.toLocaleString("en-US") : "—"}</b><small>homes</small>
      <span className="ah-links">{p.phone && <a href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}>Call</a>}{b.records.map((x, i) => <a key={`${x.source_id}-${x.record_id}`} href={x.source_url} target="_blank" rel="noreferrer" title={TAG[x.kind]}>{b.records.length > 1 ? `Source ${i + 1}` : "Source"} ↗</a>)}</span>
    </div>
  </li>;
}

export function AffordableLookup({ towns, inventoryHref }: { towns: LookupTown[]; inventoryHref: string }) {
  const [data, setData] = useState<HousingData | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [townId, setTownId] = useState<number | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [soon, setSoon] = useState(false);
  const [page, setPage] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(inventoryHref).then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true));
    // A place page hands its town on as `?town=`.
    const asked = new URLSearchParams(window.location.search).get("town");
    const match = asked ? towns.find((t) => t.name.toLowerCase() === asked.toLowerCase()) : undefined;
    if (match) { setTownId(match.id); setText(match.name); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const town = towns.find((t) => t.id === townId);
    if (town) url.searchParams.set("town", town.name); else url.searchParams.delete("town");
    window.history.replaceState(window.history.state, "", url);
  }, [townId, towns]);

  const town = towns.find((t) => t.id === townId) ?? null;
  const q = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!q || (town && town.name.toLowerCase() === q)) return [];
    const starts = towns.filter((t) => t.name.toLowerCase().startsWith(q));
    const inside = towns.filter((t) => !t.name.toLowerCase().startsWith(q) && t.name.toLowerCase().includes(q));
    return [...starts, ...inside].slice(0, 6);
  }, [q, towns, town]);

  const records = data?.records ?? [];
  const inTown = useMemo(() => town ? buildings(records.filter((r) => PROPERTY_KINDS.has(r.kind) && r.region_id === town.id)) : [], [records, town]);
  const inCounty = useMemo(() => town?.countyId ? buildings(records.filter((r) => PROPERTY_KINDS.has(r.kind) && r.region_id === town.countyId)) : [], [records, town]);
  const ending = (b: Building) => b.records.some((r) => reportedEnds(r, records).some((d) => soonAfterSnapshot(d, r.snapshot)));
  const filtered = inTown.filter((b) => kind === "all" || b.records.some((r) => r.kind === kind)).filter((r) => !soon || ending(r));
  const shown = filtered.slice(0, (page + 1) * PAGE);
  const count = (k: string) => inTown.filter((b) => k === "all" || b.records.some((r) => r.kind === k)).length;
  const homes = inTown.reduce((sum, b) => sum + (b.units ?? 0), 0);
  const endingCount = inTown.filter(ending).length;

  const pick = (t: LookupTown) => { setTownId(t.id); setText(t.name); setKind("all"); setSoon(false); setPage(0); input.current?.blur(); };

  return <section className="ah-lookup" data-kind="help">
    <div className="ah-search-wrap">
      <label className="ah-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="visually-hidden">Town</span>
        <input ref={input} value={text} placeholder={data ? "Search a town, e.g. Princeton" : "Loading affordable housing records…"} autoComplete="off" role="combobox" aria-expanded={focused && suggestions.length > 0} aria-controls="ah-suggest"
          onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) pick(suggestions[0]); }} />
      </label>
      {focused && suggestions.length > 0 && <ul className="ah-suggest" id="ah-suggest" role="listbox">{suggestions.map((t) => <li key={t.id} role="option" aria-selected={false}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t)}><b>{t.name}</b><small>{t.county}</small></button></li>)}</ul>}
    </div>
    <p className="ah-hint">Homes built or funded as affordable: town-reported, tax-credit and HUD-assisted. A building on more than one list is shown once.</p>

    {failed && <p role="alert">The records could not be loaded.</p>}

    {town && data && <article className="ah-card">
      <header className="ah-card-head">
        <div><h2>{town.name}</h2><small>{town.county} County</small></div>
        <dl className="ah-stats">
          <div><dt>Buildings</dt><dd>{inTown.length}</dd></div>
          <div title="Each building counted once, at its largest reported count."><dt>Homes</dt><dd>{homes.toLocaleString("en-US")}</dd></div>
          <div><dt>Limits ending ≤5 yrs</dt><dd>{endingCount}</dd></div>
        </dl>
      </header>
      {inTown.length > 0 && <div className="ah-filters">
        <div className="ah-chips" role="radiogroup" aria-label="Kind of record">{KINDS.map((k) => <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} disabled={count(k.key) === 0} onClick={() => { setKind(k.key); setPage(0); }}>{k.label} <small>{count(k.key)}</small></button>)}</div>
        {endingCount > 0 && <button type="button" className="ah-soon" aria-pressed={soon} onClick={() => { setSoon(!soon); setPage(0); }}>Ending soon</button>}
      </div>}
      {filtered.length ? <ul className="ah-rows">{shown.map((b) => <Row key={b.key} b={b} records={records} />)}</ul>
        : <p className="ah-empty">No records here. That doesn’t mean there are no affordable homes.</p>}
      {filtered.length > shown.length && <button type="button" className="ah-more-button" onClick={() => setPage(page + 1)}>Show more ({filtered.length - shown.length})</button>}
      {inCounty.length > 0 && <details className="ah-fold"><summary>{inCounty.length} more in {town.county}, not placed in a town<span aria-hidden="true">+</span></summary><ul className="ah-rows">{inCounty.slice(0, 40).map((b) => <Row key={b.key} b={b} records={records} />)}</ul></details>}
    </article>}

    <hr className="ah-rule" />
    <p className="ah-fine">A listing isn’t an opening: call the property or its office to ask about vacancies. To apply for help, see <a href="/help">Housing help</a>.</p>
    {data && <details className="ah-fold"><summary>Sources & limits<span aria-hidden="true">+</span></summary><ul className="ah-limits">{data.limitations.map((t) => <li key={t}><Glossed text={t} /></li>)}</ul></details>}
  </section>;
}
