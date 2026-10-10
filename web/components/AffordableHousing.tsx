"use client";

import { regionPath } from "@/lib/placeRoutes";
import { createContext, useCallback, useContext, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { artifactUrl, publicApiUrl } from "@/lib/api";
import {
  APPLICATION_ROUTES, contractsFor, inventoryUrl, reportedEnds, reportedSum, soonAfterSnapshot,
  type AffordableHousing as HousingData, type HousingRecord,
} from "@/lib/affordableHousing";

const labels: Record<string, string> = {municipal_project: "Municipal report", lihtc_property: "LIHTC · bulk inventory", hud_property: "HUD assisted"};
const n = (v: number | null) => v === null ? "Not reported" : v.toLocaleString("en-US", {maximumFractionDigits: 0});
const money = (v: number | null) => v === null ? "Not reported" : v.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0});
const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {month: "short", year: "numeric", timeZone: "UTC"});
const ProgrammePanel = createContext<boolean | null>(null);

/** Open our own disclosure after hydration, never mutate a still-hydrating parent. */
export function HousingHelpDisclosure({enabled, children}: {enabled: boolean; children: ReactNode}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash !== "#housing-assistance") return;
      setOpen(true);
      requestAnimationFrame(() => document.getElementById("housing-assistance")?.scrollIntoView({block: "start"}));
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  // Browsers can expand a native details element for a fragment before React loads.
  // Only this native open-state mismatch is expected; our effect adopts that state.
  return enabled ? <details suppressHydrationWarning open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="quiet-disclosure">
    <summary><span>Programmes, reported homes &amp; sources</span><span className="quiet-plus" aria-hidden="true">+</span></summary>
    <div className="quiet-disclosure-body"><ProgrammePanel.Provider value={open}>{children}</ProgrammePanel.Provider></div>
  </details> : <>{children}</>;
}

export function AffordableHousing({data, hideRoutes = false}: {data: HousingData | null; hideRoutes?: boolean}) {
  const programmeOpen = useContext(ProgrammePanel);
  const id = useId();
  const [program, setProgram] = useState("all");
  const [query, setQuery] = useState("");
  const [soon, setSoon] = useState(false);
  const [page, setPage] = useState(0);
  const [inventory, setInventory] = useState<HousingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const records = useMemo(() => inventory?.records ?? (data?.overview ? [] : data?.records ?? []), [data, inventory]);
  const provenance = data?.records ?? [];
  const stats = data?.stats;
  const fetchInventory = useCallback(async () => {
    if (!data || inventory || inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(false);
    try {
      const url = inventoryUrl(artifactUrl, publicApiUrl, data.region_id);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body: HousingData = await response.json();
      if (body.region_id !== data.region_id || body.overview || !Array.isArray(body.records)) throw new Error("Wrong inventory");
      setInventory(body);
    } catch { setError(true); } finally {setLoading(false); inFlight.current = false;}
  }, [data, inventory]);
  useEffect(() => {
    if (programmeOpen) void fetchInventory();
    // Fetch on the outer panel's opening, not for hidden pre-expanded children.
  }, [programmeOpen, fetchInventory]);
  const need = records.filter((r) => r.kind === "need");
  const projects = records.filter((r) => r.kind === "municipal_project");
  const funds = provenance.filter((r) => r.kind === "trust_fund");
  const reportedFunds = funds.filter((r) => r.payload.reported);
  const completed = projects.filter((r) => r.payload.completed_for_summary === true);
  const unknown = projects.filter((r) => r.payload.completed === null);
  const properties = useMemo(() => records.filter((r) => r.kind in labels)
    .filter((r) => program === "all" || r.kind === program)
    .filter((r) => `${r.payload.name} ${r.place} ${r.payload.address ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((r) => !soon || reportedEnds(r, records).some((d) => soonAfterSnapshot(d, r.snapshot))), [records, program, query, soon]);
  const shown = properties.slice(page * 10, (page + 1) * 10);

  return <section className="housing-assistance" aria-labelledby={`${id}-title`}>
    <div className="housing-assistance-head"><span className="cost-evidence-label">Housing help</span>
      <h3 id={`${id}-title`}>Affordable housing & where to apply</h3><p>Programmes, reported homes and the next official step.</p></div>
    {!hideRoutes && <div className="assistance-routes">{APPLICATION_ROUTES.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
      <small>{r.agency}</small><strong>{r.label} <span aria-hidden="true">↗</span></strong><span>{r.note}</span>
    </a>)}</div>}
    <p className="assistance-note">Links reviewed Oct 4, 2026. Open waiting lists, vacancies and eligibility are not verified here. Apply through the official administrator; an income check is not a qualification decision.</p>
    {!data ? <p className="assistance-note">No directly located inventory is loaded for this page. The official application routes above are still available. Town records are not allocated to ZIP codes.</p> : <>
      <details open={programmeOpen !== null ? true : undefined}><summary>What towns report <span>Need, completed projects & trust funds</span></summary>
        <div className="assistance-facts">
          <div><small>DCA present need · non-binding</small><strong>{n(stats ? stats.present_need ?? null : reportedSum(need, "present_need"))}</strong></div>
          <div><small>DCA prospective need · non-binding</small><strong>{n(stats ? stats.prospective_need ?? null : reportedSum(need, "prospective_need"))}</strong></div>
          <div><small>Units in projects reported completed</small><strong>{n(stats ? stats.completed_units ?? null : reportedSum(completed, "units"))}</strong></div>
          <div><small>Reported trust fund balance · partial</small><strong>{money(stats ? stats.trust_balance ?? null : reportedSum(reportedFunds, "balance"))}</strong></div>
        </div>
        <p className="assistance-note">DCA’s October 2024 calculations for 2025–2035 use the published cap. Not final court-approved obligations. Completed projects include earlier rounds and rehabilitation — not progress against this round’s need.</p>
        <p className="assistance-note">{n(stats?.projects ?? projects.length)} project records from {stats?.project_towns ?? new Set(projects.map((r) => r.region_id)).size} of {stats?.listed_towns ?? need.length} listed towns; {n(stats?.unknown_completion ?? unknown.length)} have an unknown completion status. Trust fund submissions: {stats?.funds_reported ?? reportedFunds.length} of {stats?.funds_listed ?? funds.length} listed towns. Missing reports are not zero; balances do not subtract commitments still to be spent.</p>
        {funds.length > 0 && <p className="assistance-note">Municipal workbook: {month(funds[0].snapshot)}. Fund table date: {funds[0].payload.table_as_of}; metadata cutoff: {funds[0].payload.metadata_cutoff}. DCA does not certify these self-reports.</p>}
      </details>
      <details open={programmeOpen !== null ? true : undefined} onToggle={(event) => {if (event.currentTarget.open && programmeOpen === null) void fetchInventory();}}><summary>Explore reported properties <span>By programme, not a combined total</span></summary>
        {loading && <p role="status">Loading the reported inventory…</p>}
        {error && <p role="alert">The inventory could not be loaded. <button onClick={() => void fetchInventory()}>Try again</button></p>}
        <div className="assistance-filter">
          <label htmlFor={`${id}-search`}>Name, address or town<input id={`${id}-search`} type="search" value={query} onChange={(e) => {setQuery(e.target.value); setPage(0);}} /></label>
          <label htmlFor={`${id}-program`}>Inventory<select id={`${id}-program`} value={program} onChange={(e) => {setProgram(e.target.value); setPage(0);}}><option value="all">All inventories · may overlap</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="assistance-end-filter"><input type="checkbox" checked={soon} onChange={(e) => {setSoon(e.target.checked); setPage(0);}} />Reported end within 5 years of snapshot</label>
        </div>
        <p className="assistance-note">LIHTC’s bulk inventory is historical, not proof of a current restriction or vacancy. Inventories overlap; bedroom counts describe reported units, not available homes. Disability targeting does not establish physical accessibility.</p>
        {data.county_inventory_region_id && <p className="assistance-note">HUD’s assisted-property file identifies counties, not municipalities. LIHTC records without a verified town also stay in the county or state inventory. <Link href={`${regionPath(data.county_inventory_region_id)}#housing-assistance`}>See this county’s inventory →</Link></p>}
        <p className="assistance-result-count" role="status">{properties.length} matching records · displayed separately, never added across programmes</p>
        <ul className="assistance-properties">{shown.map((r) => <Property key={`${r.source_id}-${r.record_id}`} row={r} records={records} />)}</ul>
        {!shown.length && !loading && !error && inventory && <p>No records match. This does not establish that no affordable homes exist here.</p>}
        {properties.length > 10 && <nav aria-label="Property result pages" className="assistance-pages"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{page + 1} / {Math.ceil(properties.length / 10)}</span><button disabled={(page + 1) * 10 >= properties.length} onClick={() => setPage(page + 1)}>Next</button></nav>}
      </details>
      <details className="assistance-method"><summary>Sources & limits</summary><ul>{data.limitations.map((t) => <li key={t}>{t}</li>)}</ul>
        <ul>{provenance.map((r) => <li key={`${r.source_id}-${r.kind}`}><a href={r.source_url} target="_blank" rel="noreferrer">{r.source_id} · {r.kind.replaceAll("_", " ")}</a> · snapshot {r.snapshot} · downloaded {r.fetched_at.slice(0, 10)} · release {r.release_id}</li>)}</ul>
      </details>
    </>}
  </section>;
}

function Property({row: r, records}: {row: HousingRecord; records: HousingRecord[]}) {
  const contracts = r.kind === "hud_property" ? contractsFor(r, records) : [];
  const p = r.payload;
  const beds = Object.entries(p.bedrooms ?? {}).filter(([, v]) => v !== null && v > 0);
  return <li className="assistance-property"><header><span>{labels[r.kind]}</span><strong>{p.name || "Unnamed project"}</strong><small>{r.place}{p.address ? ` · ${p.address}, ${p.city ?? ""}` : ""}</small></header>
    <div className="assistance-property-facts"><span>{n(p.units ?? null)} {r.kind === "municipal_project" ? "reported affordable units" : "total property units"}</span>
      {r.kind === "lihtc_property" && <span>{n(p.low_income_units ?? null)} low-income units · placed in service {p.placed_in_service ?? "not reported"}</span>}
      {r.kind === "lihtc_property" && <>
        <span>Bulk coverage through {p.coverage_through ?? "not reported"}{p.service_year_status === "after coverage year" ? " · reported service year falls after this release’s coverage" : p.service_year_status === "unconfirmed" ? " · placed-in-service status unconfirmed" : p.service_year_status === "year unknown" ? " · service confirmed, year unknown" : ""}</span>
        <span>{p.no_longer_monitored === true ? "No longer monitored for LIHTC compliance; continued affordability is not established." : p.no_longer_monitored === false ? "Not flagged as no longer monitored; confirm current restrictions." : "LIHTC monitoring status not reported."}</span>
        {p.affordability_years != null && <span>Reported affordability period: {p.affordability_years} years · not an expiration date</span>}
        {p.resyndicated && <span>Reported resyndication; may repeat an earlier development.</span>}
        {p.location_scope === "county" && <span>Located to county only; municipality not established.</span>}
      </>}
      {r.kind === "municipal_project" && <span>Completion: {p.completed === true ? "CO granted" : p.completed === false ? "CO not granted" : "not reported"}{p.completion_date ? ` · ${p.completion_date}` : ""}</span>}
      {p.completed && p.completion_date && p.completion_date > r.snapshot && <span>CO date is after this workbook; omitted from the completion total.</span>}
      {beds.length > 0 && <span>Bedrooms: {beds.map(([bed, count]) => `${bed}BR ${n(count)}`).join(" · ")}</span>}
      {p.location_scope?.startsWith("state only") && <span>Located to New Jersey only; county not established.</span>}
      {(p.special_needs_units ?? 0) > 0 && <span>{n(p.special_needs_units ?? null)} special-needs units · accessibility not supplied</span>}
      {(p.senior_units ?? 0) > 0 && <span>{n(p.senior_units ?? null)} senior units</span>}
      {p.targeted_seniors && <span>Reported target population: seniors</span>}
      {p.targeted_disability && <span>Reported target population: disabled residents · physical accessibility not supplied</span>}
      {p.earliest_controls_end && <span>Earliest reported controls end {p.earliest_controls_end} · may cover only some units; renewal possible</span>}
      {contracts.map((c) => <span key={c.record_id}>{c.payload.program} · {n(c.payload.units ?? null)} assisted units · {c.payload.status} at snapshot · contract end {c.payload.contract_end ?? "not reported"}
        {Object.entries(c.payload.bedrooms ?? {}).filter(([, v]) => v !== null && v > 0).map(([bed, count]) => ` · ${bed}BR ${n(count)}`)}
        {(c.payload.bedrooms_5plus ?? 0) > 0 && ` · 5+BR ${n(c.payload.bedrooms_5plus ?? null)}`}</span>)}
      {r.kind === "hud_property" && !contracts.length && <span>No matched contract record; do not infer current assistance.</span>}
    </div><footer><a href={r.source_url} target="_blank" rel="noreferrer">Source ↗</a><span>Snapshot {month(r.snapshot)} · record {r.record_id}</span>{p.phone && <span>Property contact: {p.phone}</span>}</footer>
  </li>;
}
