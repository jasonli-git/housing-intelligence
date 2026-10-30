"use client";

import { useEffect, useMemo, useState } from "react";
import { DataFlow } from "./DataFlow";
import styles from "./DataExplorer.module.css";
import { shortBytes, tableFlow, traceLineage, type Catalog, type CatalogColumn } from "@/lib/dataCatalog";
import { TERMS_BY_ID } from "@/lib/terms";

const AREAS = [
  { id: "dictionary", label: "Data dictionary", intro: "Every published figure: what it means, where it comes from and what it covers." },
  { id: "schema", label: "Schema explorer", intro: "Search every staged and serving table, and their columns." },
  { id: "lineage", label: "Interactive lineage", intro: "Pick a figure or a publisher to follow it through the pipeline." },
  { id: "profiling", label: "Data profiling", intro: "How much each table and figure holds, and how complete it is." },
  { id: "warehouse", label: "Warehouse diagram", intro: "The stages the data passes through, from publisher to this site." },
  { id: "erd", label: "ERD", intro: "An entity relationship diagram: how the serving tables join." },
] as const;
type Area = (typeof AREAS)[number]["id"];

const STAGES = [
  ["Publishers", "Files and APIs, fetched as released"],
  ["Raw archive", "Every download kept unchanged"],
  ["Parquet", "One typed copy of each file"],
  ["Staged tables", "Cleaned and tested with dbt in DuckDB"],
  ["Serving tables", "Loaded into Postgres with their source release"],
  ["Published files", "Static JSON behind this site"],
];

const TIERS: Record<string, string> = { raw: "Raw downloads", parquet: "Parquet", duckdb: "Staged tables (DuckDB)", packets: "Model packets", postgres: "Serving tables (Postgres)" };

const n = (value: number | null | undefined) => value == null ? "–" : value.toLocaleString("en-US");
const share = (value: number) => `${(value * 100).toFixed(value > 0 && value < .01 ? 1 : 0)}%`;

function Columns({ columns }: { columns: CatalogColumn[] }) {
  if (!columns.length) return <p className={styles.note}>Columns are not recorded for this table.</p>;
  const profiled = columns.some((c) => c.null_share != null);
  return <div className={styles.scroll}><table className={styles.table}>
    <thead><tr><th scope="col">Column</th><th scope="col">Type</th>{profiled && <><th scope="col">Empty</th><th scope="col">Distinct, about</th></>}</tr></thead>
    <tbody>{columns.map((c) => <tr key={c.name}><td><code>{c.name}</code></td><td>{c.type}</td>
      {profiled && <><td>{c.null_share == null ? "–" : share(c.null_share)}</td><td>{n(c.distinct)}</td></>}</tr>)}</tbody>
  </table></div>;
}

function CatalogArea({ catalog, trace, schema }: { catalog: Catalog; trace: (id: string) => void; schema: boolean }) {
  const [query, setQuery] = useState("");
  const [picked, setKind] = useState("staged");
  const kind = schema ? picked : "figures";
  const [limit, setLimit] = useState(30);
  const q = query.trim().toLowerCase();
  const has = (...text: (string | undefined)[]) => !q || text.some((t) => t?.toLowerCase().includes(q));
  const sourceName = new Map(catalog.sources.map((s) => [s.id, s.name]));
  const entries = kind === "figures"
    ? catalog.metrics.filter((m) => has(m.label, m.id, m.description, sourceName.get(m.source))).map((m) => {
      const term = TERMS_BY_ID[m.id];
      return <details key={m.id} className={styles.entry}><summary><strong>{m.label}</strong><span>{sourceName.get(m.source) ?? "Calculated here"}</span></summary>
        <p>{term?.what ?? m.description}</p>{term?.why && <p>{term.why}</p>}
        <dl><div><dt>Field</dt><dd><code>{m.id}</code></dd></div><div><dt>Kind</dt><dd>{m.kind}</dd></div><div><dt>Unit</dt><dd>{m.unit}</dd></div><div><dt>Updated</dt><dd>{m.frequency}</dd></div><div><dt>Places</dt><dd>{n(m.places)}</dd></div></dl>
        <button type="button" className={styles.link} onClick={() => trace(`metric:${m.id}`)}>Trace this figure →</button></details>;
    })
    : kind === "staged"
      ? catalog.models.filter((m) => has(m.name, m.description) || m.columns.some((c) => has(c.name))).map((m) => <details key={m.name} className={styles.entry}><summary><strong><code>{m.name}</code></strong><span>{n(m.rows)} rows</span></summary>
        {m.description && <p>{m.description}</p>}<Columns columns={m.columns} />
        <button type="button" className={styles.link} onClick={() => trace(`model:${m.name}`)}>Trace this table →</button></details>)
      : catalog.tables.filter((t) => has(t.name) || t.columns.some((c) => has(c.name))).map((t) => <details key={t.name} className={styles.entry}><summary><strong><code>{t.name}</code></strong><span>about {n(t.rows)} rows</span></summary><Columns columns={t.columns} /></details>);
  return <>
    <div className={styles.controls}>
      <label>Search<input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(30); }} /></label>
      {schema && <label>Show<select value={picked} onChange={(e) => { setKind(e.target.value); setLimit(30); }}>
        <option value="staged">Staged tables ({catalog.models.length})</option>
        <option value="serving">Serving tables ({catalog.tables.length})</option>
      </select></label>}
    </div>
    <p className={styles.note} role="status">{entries.length} matching</p>
    <div>{entries.slice(0, limit)}</div>
    {entries.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(entries.length)}>Show all {entries.length}</button>}
  </>;
}

function LineageArea({ catalog, focus, setFocus }: { catalog: Catalog; focus: string; setFocus: (id: string) => void }) {
  const flow = useMemo(() => traceLineage(catalog, focus), [catalog, focus]);
  const figures = [...catalog.metrics].sort((a, b) => a.label.localeCompare(b.label));
  return <>
    <div className={styles.controls}><label>Start from<select value={focus} onChange={(e) => setFocus(e.target.value)}>
      <optgroup label="Published figures">{figures.map((m) => <option key={m.id} value={`metric:${m.id}`}>{m.label}</option>)}</optgroup>
      <optgroup label="Publishers">{catalog.sources.map((s) => <option key={s.id} value={`source:${s.id}`}>{s.name}</option>)}</optgroup>
      <optgroup label="Staged tables">{catalog.models.map((m) => <option key={m.name} value={`model:${m.name}`}>{m.name}</option>)}</optgroup>
    </select></label></div>
    <DataFlow flow={flow} active={focus} label="Lineage of the selected item" onSelect={setFocus} />
    <p className={styles.note}>A figure no staged table names is shown coming straight from its publisher; a calculated figure, from the figures it uses.</p>
  </>;
}

function QualityArea({ catalog }: { catalog: Catalog }) {
  const empty = catalog.metrics.filter((m) => !m.observations);
  const tables = [...catalog.tables].sort((a, b) => b.rows - a.rows);
  return <>
    {!!catalog.storage?.length && <>
      <h3>Storage by tier</h3>
      <div className={styles.scroll}><table className={styles.table}>
        <thead><tr><th scope="col">Tier</th><th scope="col">Size</th><th scope="col">Share</th></tr></thead>
        <tbody>{catalog.storage.map((tier) => <tr key={tier.name}><td>{TIERS[tier.name] ?? tier.name}</td><td>{shortBytes(tier.bytes)}</td><td>{share(tier.bytes / catalog.storage!.reduce((sum, t) => sum + t.bytes, 0))}</td></tr>)}</tbody>
      </table></div>
      <p className={styles.note}>Tiers hold copies of the same data at different stages, so the total is disk used, not unique data.</p>
    </>}
    <h3>Serving tables</h3>
    <div className={styles.scroll}><table className={styles.table}>
      <thead><tr><th scope="col">Table</th><th scope="col">Rows, about</th><th scope="col">Size</th><th scope="col">Emptiest column</th></tr></thead>
      <tbody>{tables.map((t) => {
        const worst = t.columns.filter((c) => c.null_share != null).sort((a, b) => b.null_share! - a.null_share!)[0];
        return <tr key={t.name}><td><code>{t.name}</code></td><td>{n(t.rows)}</td><td>{shortBytes(t.bytes)}</td><td>{worst?.null_share ? <><code>{worst.name}</code> {share(worst.null_share)}</> : "None empty"}</td></tr>;
      })}</tbody>
    </table></div>
    <h3>Figures by coverage</h3>
    <div className={styles.scroll}><table className={styles.table}>
      <thead><tr><th scope="col">Figure</th><th scope="col">Places</th><th scope="col">Values</th><th scope="col">Earliest</th><th scope="col">Latest</th></tr></thead>
      <tbody>{catalog.metrics.filter((m) => m.observations).sort((a, b) => b.observations - a.observations).map((m) => <tr key={m.id}><td>{m.label}</td><td>{n(m.places)}</td><td>{n(m.observations)}</td><td>{m.first}</td><td>{m.last}</td></tr>)}</tbody>
    </table></div>
    {empty.length > 0 && <p className={styles.note}>{empty.length} defined {empty.length === 1 ? "figure holds" : "figures hold"} no values in the main table, usually because they sit in a table of their own: {empty.slice(0, 6).map((m) => m.label).join("; ")}{empty.length > 6 ? "; and others" : ""}.</p>}
    <p className={styles.note}>Rows, empty shares and distinct counts are the database’s own estimates. {n(catalog.models.reduce((sum, m) => sum + m.tests, 0))} tests are declared in the pipeline.</p>
  </>;
}

function WarehouseArea() {
  return <ol className={styles.stages}>{STAGES.map(([name, what]) => <li key={name}><strong>{name}</strong><span>{what}</span></li>)}</ol>;
}

function ErdArea({ catalog }: { catalog: Catalog }) {
  const flow = useMemo(() => tableFlow(catalog.tables), [catalog]);
  const [active, setActive] = useState("fact_metric_observation");
  const table = catalog.tables.find((t) => t.name === active);
  const children = catalog.tables.flatMap((t) => t.foreign_keys.filter((k) => k.references === active).map((k) => `${t.name}.${k.column}`));
  return <>
    <DataFlow flow={flow} active={active} label="Tables and the keys that join them" onSelect={setActive} focused />
    {table && <div className={styles.detail}><h4><code>{table.name}</code></h4>
      <p>{table.foreign_keys.length ? `Points to: ${table.foreign_keys.map((k) => `${k.references} (by ${k.column})`).join(", ")}.` : "Points to no other table."}{" "}{children.length ? `Referenced by ${children.length} ${children.length === 1 ? "column" : "columns"}.` : ""}</p>
      <details><summary>Columns</summary><Columns columns={table.columns} /></details></div>}
  </>;
}

export function DataExplorer({ catalog }: { catalog: Catalog }) {
  const [area, setArea] = useState<Area>("dictionary");
  const [focus, setFocus] = useState(`metric:${catalog.metrics.find((m) => m.observations)?.id ?? catalog.metrics[0]?.id}`);
  useEffect(() => {
    const follow = () => {
      const hash = location.hash.slice(1);
      if (AREAS.some((a) => a.id === hash)) setArea(hash as Area);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  const open = (id: Area) => { setArea(id); history.replaceState(null, "", `#${id}`); };
  const current = AREAS.find((a) => a.id === area)!;
  const storedTotal = (catalog.storage ?? []).reduce((sum, tier) => sum + tier.bytes, 0);
  const stats = [["Sources", catalog.sources.length], ["Staged tables", catalog.models.length], ["Serving tables", catalog.tables.length], ["Figures", catalog.metrics.length], ["Values", n(catalog.metrics.reduce((sum, m) => sum + m.observations, 0))], ["Total stored", storedTotal ? shortBytes(storedTotal) : "–"]] as const;
  return <section className={styles.explorer}>
    <dl className={styles.stats}>{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "number" ? n(value) : value}</dd></div>)}</dl>
    <div className={styles.workspace}>
    <div className={styles.tabs} role="tablist" aria-orientation="vertical" aria-label="Data explorer areas">{AREAS.map((a) =>
      <button key={a.id} type="button" role="tab" id={`tab-${a.id}`} aria-selected={area === a.id} aria-controls="data-panel" onClick={() => open(a.id)}>{a.label}</button>)}</div>
    <div id="data-panel" className={styles.panel} role="tabpanel" aria-labelledby={`tab-${area}`}>
      <h2>{current.label}</h2>
      <p className={styles.intro}>{current.intro}{area === "erd" ? " Select a table to see its joins." : ""}</p>
      {(area === "dictionary" || area === "schema") && <CatalogArea key={area} schema={area === "schema"} catalog={catalog} trace={(id) => { setFocus(id); open("lineage"); }} />}
      {area === "lineage" && <LineageArea catalog={catalog} focus={focus} setFocus={setFocus} />}
      {area === "profiling" && <QualityArea catalog={catalog} />}
      {area === "warehouse" && <WarehouseArea />}
      {area === "erd" && <ErdArea catalog={catalog} />}
    </div>
    </div>
  </section>;
}
