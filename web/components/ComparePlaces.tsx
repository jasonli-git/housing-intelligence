"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import { Term } from "@/components/Term";
import type { Packet, PacketLevel } from "@/lib/api";
import { formatChange } from "@/lib/format";
import { KIND_LABELS, KIND_MEANINGS, kindOf, type RecordType } from "@/lib/kinds";
import { ownershipInputs, utilityTotal } from "@/lib/budgetScenario";
import { COMPARE_SECTIONS, levelOf, MAX_PLACES, parsePlaces, placesQuery } from "@/lib/compare";
import { formatMetric, formatValue, SHARE_METRICS } from "@/lib/format";
import { homePrice } from "@/lib/homePrice";
import { eachMonth } from "@/lib/ownership";
import { periodLabel } from "@/lib/periods";
import { regionPath } from "@/lib/placeRoutes";
import type { SearchEntry } from "@/lib/search";
import { marginLabel } from "@/lib/uncertainty";

/**
 * Places side by side (TODO "A compare page shared by its link"). The address holds the
 * choice and each place's published packet supplies its figures, so the page stores
 * nothing and publishes nothing per comparison (`lib/compare.ts`).
 */

type Loaded = { id: number; packet: Packet | null };

async function loadPacket(artifactUrl: string, id: number): Promise<Packet | null> {
  try {
    const response = await fetch(`${artifactUrl}/regions/${id}/packet/5y.json`);
    return response.ok ? ((await response.json()) as Packet) : null;
  } catch {
    return null;
  }
}

function Figure({ level, baseline, baselineName }: { level: PacketLevel | null; baseline?: PacketLevel | null; baselineName?: string }) {
  if (!level) return <span className="compare-missing">Not published</span>;
  const margin = level.survey ? marginLabel(level.value, level.margin_of_error ?? null, level.unit, level.metric_id) : null;
  const kind = (level.record_type as RecordType | null | undefined) ?? kindOf(level.metric_id);
  return (
    <>
      <strong>{formatMetric(level.value, level.unit, level.metric_id)}</strong>
      <small>
        {periodLabel(level.period_end, level.metric_id)}
        {margin ? ` · ${margin}` : ""}
      </small>
      {kind && <Kind kind={kind} />}
      {baseline && baselineName && (baseline.period_start === level.period_start && baseline.period_end === level.period_end && baseline.unit === level.unit ?
        <small className="compare-difference">{level.value === baseline.value ? "Same as" : `${level.value > baseline.value ? "+" : "−"}${(level.unit === "percent" || SHARE_METRICS.has(level.metric_id) ? `${(Math.abs(level.value - baseline.value) * (level.unit === "ratio" ? 100 : 1)).toFixed(1)} percentage points` : formatMetric(Math.abs(level.value - baseline.value), level.unit, level.metric_id))} vs`} {baselineName}</small> :
        <small className="compare-difference">Different periods or units · no difference calculated</small>)}
    </>
  );
}

/** What kind of figure it is, as on the place pages: solid for records, dashed for estimates. */
function Kind({ kind }: { kind: RecordType }) {
  return <small className="compare-kind" data-kind={kind} title={KIND_MEANINGS[kind]}>{KIND_LABELS[kind]}</small>;
}

/** The overview leads with the place pages' own four figures, for a buyer or a renter (#492). */
const OVERVIEW: Record<"buy" | "rent", readonly string[]> = {
  buy: ["sr1a_median_sale_price", "zhvi_sfr", "own", "modiv_median_tax_bill", "change:zhvi_sfr", "acs_median_hh_income", "acs_mean_commute_minutes"],
  rent: ["zori_all", "acs_median_gross_rent", "change:zori_all", "acs_renter_cost_burden", "acs_median_hh_income", "acs_mean_commute_minutes"],
};
const OVERVIEW_LABELS: Record<string, string> = { sr1a_median_sale_price: "Median home sale price", zhvi_sfr: "Typical home value, Zillow’s estimate", modiv_median_tax_bill: "Median yearly property tax", zori_all: "Typical asking rent", acs_median_gross_rent: "Median rent tenants pay, with utilities", acs_renter_cost_burden: "Renters paying over 30% of income", acs_median_hh_income: "Household income", acs_mean_commute_minutes: "Average commute", "change:zhvi_sfr": "Home value, five-year change", "change:zori_all": "Asking rent, five-year change" };

/** The month to own the typical home at the national rate, 20% down, as the place page works it out. */
function ownMonth(packet: Packet, ratePct: number): { value: number; partial: boolean } | null {
  const levels = packet.levels;
  const home = homePrice(levels);
  if (!home) return null;
  const value = (id: string) => levelOf(levels, id)?.value ?? null;
  const month = eachMonth(
    ownershipInputs({
      state: packet.region.state_code,
      price: home.value,
      ratePct,
      taxYear: value("modiv_median_tax_bill"),
      insuranceYear: value("acs_median_home_insurance"),
      utilitiesMonth: utilityTotal(value("acs_median_electricity"), value("acs_median_gas"), value("acs_median_water_sewer")),
      rentMonth: value("zori_all"),
    }),
  );
  return { value: month.total, partial: month.missing.length > 0 };
}

/** MOCK (2026-11-11): pairings to start from, so the empty page is never a blank field. */
const PAIRINGS: { ids: number[]; names: string[]; note: string }[] = [
  { ids: [224, 241], names: ["Princeton", "West Windsor"], note: "Neighbours in Mercer County" },
  { ids: [344, 141], names: ["Hoboken", "Jersey City"], note: "The Hudson waterfront" },
  { ids: [394, 393], names: ["Montclair", "Maplewood"], note: "Essex County suburbs" },
  { ids: [85, 507], names: ["Cherry Hill", "Haddonfield"], note: "Camden County, side by side" },
  { ids: [176, 244], names: ["Red Bank", "Asbury Park"], note: "Monmouth shore towns" },
  { ids: [8, 7, 4], names: ["Bergen", "Essex", "Hudson"], note: "Three counties by New York" },
];

function CompareEmpty({ onPick, rows }: { onPick: (ids: number[]) => void; rows: string[] }) {
  return <div className="compare-empty">
    <section aria-labelledby="compare-pairs">
      <h2 className="compare-empty-label" id="compare-pairs">Or start with a pairing</h2>
      <ul className="compare-pairs">{PAIRINGS.map((pair) => <li key={pair.ids.join("-")}>
        <button type="button" aria-label={`Compare ${pair.names.join(", ")}`} onClick={() => onPick(pair.ids)}>
          <span className="compare-pair-names">{pair.names.map((name, n) => <span key={name}>{n > 0 && <i aria-hidden="true">vs</i>}{name}</span>)}</span>
          <small>{pair.note}</small>
        </button>
      </li>)}</ul>
    </section>
    <section className="compare-preview" aria-labelledby="compare-preview-label">
      <h2 className="compare-empty-label" id="compare-preview-label">What you’ll see</h2>
      <div className="compare-ghost" aria-hidden="true">
        <div className="compare-ghost-head"><span />{[1, 2, 3, 4].map((n) => <b key={n}>Place {n}</b>)}</div>
        {rows.map((row) => <div key={row} className="compare-ghost-row"><span>{row}</span>{[1, 2, 3, 4].map((n) => <i key={n} />)}</div>)}
      </div>
      <p className="compare-share">Each figure dated and sourced as on its own page, with the difference from the first place. Switch to renting, or to any topic, once places are in.</p>
    </section>
  </div>;
}

export function ComparePlaces({ artifactUrl, rate }: { artifactUrl: string; rate: { value: number; asOf: string } }) {
  const [ids, setIds] = useState<number[]>([]);
  const [places, setPlaces] = useState<Loaded[]>([]);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(max-width: 600px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [topic, setTopic] = useState("Overview");
  // Buying or renting rides in the address, as on the place pages (`?for=rent`, #490).
  const [tenure, setTenure] = useState<"buy" | "rent">("buy");
  const [mobileOther, setMobileOther] = useState<number | null>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);

  useEffect(() => {
    setIds(parsePlaces(window.location.search));
    if (new URLSearchParams(window.location.search).get("for") === "rent") setTenure("rent");
    fetch("/search.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((list: SearchEntry[] | null) => setEntries((list ?? []).filter((e) => e.level !== "state")))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all(ids.map(async (id) => ({ id, packet: await loadPacket(artifactUrl, id) }))).then((loaded) => {
      if (live) setPlaces(loaded);
    });
    return () => {
      live = false;
    };
  }, [artifactUrl, ids]);

  const update = (next: number[]) => {
    setIds(next);
    const url = new URL(window.location.href);
    const renting = url.searchParams.get("for") === "rent";
    url.search = `${placesQuery(next)}${renting ? `${next.length ? "&" : "?"}for=rent` : ""}`;
    window.history.replaceState(null, "", url);
  };
  const choose = (next: "buy" | "rent") => {
    setTenure(next);
    const url = new URL(window.location.href);
    url.search = `${placesQuery(ids)}${next === "rent" ? `${ids.length ? "&" : "?"}for=rent` : ""}`;
    window.history.replaceState(null, "", url);
  };
  const add = (entry: SearchEntry) => {
    if (!ids.includes(entry.id) && ids.length < MAX_PLACES) update([...ids, entry.id]);
  };
  const remove = (id: number) => update(ids.filter((other) => other !== id));
  const shown = places.filter((place) => ids.includes(place.id));

  const baseline = shown[0]?.packet;
  const secondId = ids.includes(mobileOther ?? -1) && mobileOther !== ids[0] ? mobileOther : ids[1];
  const mobileVisible = (id: number) => id === ids[0] || id === secondId;
  const columns = mobile ? shown.filter(place => mobileVisible(place.id)) : shown;
  type Row = { metric: string; label?: string } | { cost: "own" } | { change: string; label: string };
  const overviewRows: Row[] = OVERVIEW[tenure].map((key) => key === "own" ? { cost: "own" as const } : key.startsWith("change:") ? { change: key.slice(7), label: OVERVIEW_LABELS[key] } : { metric: key, label: OVERVIEW_LABELS[key] });
  const sections: { title: string; rows: Row[] }[] = topic === "Overview" ? [{ title: tenure === "rent" ? "For a renter" : "For a buyer", rows: overviewRows }] : COMPARE_SECTIONS.filter(section => topic === "All figures" || section.title === topic);

  return (
    <div className="compare-places" data-count={shown.length}>
      <div className="compare-picker">
        {ids.length < MAX_PLACES ? (
          <>
            <p className="compare-picker-label" aria-hidden="true">{ids.length ? `Add a place (${ids.length} of ${MAX_PLACES})` : "Choose a place to start"}</p>
            <PlacePicker
              entries={entries}
              onPick={add}
              label={ids.length ? "Add another place" : "Choose a place to start"}
              placeholder="Search a county, town or ZIP code"
              name="compare-place"
              className="compare-picker-field"
            />
          </>
        ) : (
          <p className="meta">4 places selected. Remove one to add another.</p>
        )}
        <p className="compare-share">
          Bookmark or share this address to keep your comparison.
        </p>
      </div>

      {ids.length === 0 && <CompareEmpty onPick={update} rows={OVERVIEW.buy.map((key) => key === "own" ? "Monthly cost to own" : OVERVIEW_LABELS[key])} />}

      {ids.length > shown.length && <p role="status">Loading selected places…</p>}
      {shown.length > 0 && <>
        <div className="compare-topic-picker">{topic === "Overview" && <div className="compare-tenure" role="group" aria-label="Show figures for"><button type="button" aria-pressed={tenure === "buy"} onClick={() => choose("buy")}>Buying</button><button type="button" aria-pressed={tenure === "rent"} onClick={() => choose("rent")}>Renting</button></div>}<label>Show <select value={topic} onChange={event => setTopic(event.target.value)}>{["Overview", ...COMPARE_SECTIONS.map(section => section.title), "All figures"].map(title => <option key={title}>{title}</option>)}</select></label></div>
        {baseline && <details className="compare-reading"><summary>Differences from {baseline.region.label}</summary><p>Differences use matching periods, units and geographic levels. Survey differences are arithmetic, not a test of significance; read them with the margins shown. Counties, towns and ZIP codes describe different geographic areas.</p></details>}
        {ids.length > 2 && <label className="compare-mobile-picker">Compare the starting place with <select value={secondId ?? ""} onChange={event => setMobileOther(Number(event.target.value))}>{shown.slice(1).map(place => <option key={place.id} value={place.id}>{place.packet?.region.label ?? `Place ${place.id}`}</option>)}</select></label>}
      </>}
      {shown.length > 0 && (
        <div className="compare-scroll" role="region" aria-label="Places compared" tabIndex={0}>
          <table className="compare-table">
            <caption className="visually-hidden">The places you chose, figure by figure</caption>
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Figure</span></th>
                {columns.map(({ id, packet }) => (
                  <th scope="col" key={id} data-mobile-visible={mobileVisible(id)}>
                    {packet ? <Link href={regionPath(id)}>{packet.region.label}</Link> : <span>Place {id}</span>}
                    <button type="button" className="compare-remove" onClick={() => remove(id)} aria-label={`Remove ${packet?.region.label ?? `place ${id}`}`}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.title}>
                <tr className="compare-section">
                  <th scope="rowgroup" colSpan={columns.length + 1}>{section.title}</th>
                </tr>
                {section.rows.map((row) => {
                  if ("cost" in row) {
                    return (
                      <tr key="own">
                        <th scope="row">
                          <Term id="cost_to_own" title="The month to own" definition={`The typical home at ${rate.value.toFixed(2)}%, the national 30-year rate (${rate.asOf}), 20% down, with property tax, insurance, utilities and upkeep where published — as each place’s own page works it out.`}>
                            Monthly cost to own
                          </Term>
                        </th>
                        {columns.map(({ id, packet }) => {
                          const own = packet ? ownMonth(packet, rate.value) : null;
                          return (
                            <td key={id} data-mobile-visible={mobileVisible(id)}>
                              {own ? (
                                <>
                                  <strong>{formatValue(own.value, "usd")}</strong>
                                  <small>{own.partial ? "partial: some costs unpublished" : `at ${rate.value.toFixed(2)}%, 20% down`}</small>
                                  <Kind kind="calculated" />
                                </>
                              ) : (
                                <span className="compare-missing">No home price</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                  if ("change" in row) {
                    return (
                      <tr key={`change-${row.change}`}>
                        <th scope="row">{row.label}</th>
                        {columns.map(({ id, packet }) => {
                          const m = packet?.metrics.find((metric) => metric.metric_id === row.change);
                          const kind = kindOf(row.change);
                          return <td key={id} data-mobile-visible={mobileVisible(id)}>{m ? <><strong>{formatChange(m.pct_change)}</strong><small>{m.window_start.slice(0, 4)} to {m.window_end.slice(0, 4)}{m.rank && m.of ? ` · ${m.rank} of ${m.of}` : ""}</small>{kind && <Kind kind={kind} />}</> : <span className="compare-missing">{packet ? "Not published" : "Could not load"}</span>}</td>;
                        })}
                      </tr>
                    );
                  }
                  const label = row.label ?? row.metric;
                  return (
                    <tr key={row.metric}>
                      <th scope="row"><Term id={row.metric}>{label}</Term></th>
                      {columns.map(({ id, packet }) => (
                        <td key={id} data-mobile-visible={mobileVisible(id)}>{packet ? <Figure level={levelOf(packet.levels, row.metric)} baseline={id !== shown[0]?.id && baseline && packet.region.level === baseline.region.level ? levelOf(baseline.levels, row.metric) : null} baselineName={baseline?.region.label} /> : <span className="compare-missing">Could not load</span>}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
