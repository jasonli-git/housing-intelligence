"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type Hit,
  matchStreets,
  normaliser,
  type Normaliser,
  parcelsOn,
  parseQuery,
  shardOf,
  type StreetMeta,
  placesFor,
  type StreetShard,
} from "@/lib/addressSearch";
import { PropertyDetails } from "@/components/PropertyDetails";
import { countyLookup } from "@/lib/countyLookups";
import { formatValue } from "@/lib/format";
import {
  addressCase,
  appealDeadline,
  classPercentile,
  describeBuilding,
  impliedValue,
  type Parcel,
  type ParcelFile,
  parcelsOf,
  REVALUATION_RATIO,
  revaluationIndicated,
  search,
} from "@/lib/parcels";
import { PRIVACY_EMAIL } from "@/lib/site";

export type Town = { geoid: string; name: string; county: string };

const APPEALS = "https://www.nj.gov/treasury/taxation/lpt/lpt-appeal.shtml";
const CHAPTER_123 = "https://www.nj.gov/treasury/taxation/lpt/statdata.shtml";
/** Where a covered person asks for an address to come off the lookup (ARCHITECTURE #295). */
export const REMOVAL_EMAIL = PRIVACY_EMAIL;

// "12/3", "12, 3", "block 12 lot 3" or "12 lot 3": a block and a lot, which repeat from
// town to town and so still need one.
const BLOCK_LOT = /^\s*(?:block\s*)?[0-9a-z.]+\s*(?:\/|,|\s+lot\s+)\s*[0-9a-z.]+\s*$/i;
// More places than this and the reader picks one, rather than the page fetching them all.
const FETCH_AT_ONCE = 3;

function usd(value: number | null): string {
  return value === null ? "—" : formatValue(value, "usd");
}

// The state's property classes, as a reader would say them.
const PLAIN_CLASS: Record<string, string> = {
  "Residential, one to four families": "Home (1–4 families)",
  "Apartments, five or more": "Apartment building (5+ units)",
  "Farm, with a house": "Farm with a house",
  "Other school": "Private school",
  "Public property": "Government property",
  "Other exempt": "Tax-exempt property",
};
export const plainClass = (name: string) => PLAIN_CLASS[name] ?? name;

function parcelName(parcel: Parcel): string {
  const where = `Block ${parcel.block}, lot ${parcel.lot}${parcel.qualifier ? `, ${parcel.qualifier}` : ""}`;
  return parcel.address ? `${addressCase(parcel.address)} · ${where}` : where;
}

type Found = { file: ParcelFile; parcels: Parcel[]; parcel: Parcel };

/**
 * Find any property in New Jersey from one typed address (Milestone 38). The street
 * index names the towns that have the street and the house number; only those towns'
 * files are fetched, and only up to `FETCH_AT_ONCE` before the reader is asked to choose.
 * A block and lot still takes a town, since those numbers repeat across the state.
 */
export function TaxLookup({
  towns,
  artifactUrl,
  rate = null,
}: {
  towns: Town[];
  artifactUrl: string;
  rate?: { value: number; asOf: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");
  const townFilter = useRef<HTMLDetailsElement>(null);
  const [meta, setMeta] = useState<StreetMeta | null>(null);
  const [shard, setShard] = useState<{ key: string; data: StreetShard } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [chosen, setChosen] = useState<Found | null>(null);
  const [, setLoaded] = useState(0);
  const files = useRef(new Map<string, ParcelFile | "loading" | "failed">());

  const label = (t: Town) => `${t.name}, ${t.county} County`;
  const town = useMemo(
    () => towns.find((t) => label(t).toLowerCase() === townQuery.trim().toLowerCase()) ?? null,
    [towns, townQuery],
  );
  // A town page links here as `/tax?town=<geoid>`, choosing the town for the reader.
  useEffect(() => {
    const geoid = new URLSearchParams(window.location.search).get("town");
    const linked = towns.find((t) => t.geoid === geoid);
    if (linked) { setTownQuery(label(linked)); if (townFilter.current) townFilter.current.open = true; }
  }, [towns]);

  useEffect(() => {
    fetch(`${artifactUrl}/parcels/streets/meta.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: StreetMeta) => setMeta(data))
      .catch(() => setError("The property records could not be loaded."));
  }, [artifactUrl]);
  const n: Normaliser | null = useMemo(() => (meta ? normaliser(meta.words) : null), [meta]);

  const fileOf = useCallback(
    (geoid: string): ParcelFile | null => {
      const held = files.current.get(geoid);
      if (held && typeof held === "object") return held;
      if (!held) {
        files.current.set(geoid, "loading");
        fetch(`${artifactUrl}/parcels/${geoid}.json`)
          .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
          .then((data: ParcelFile) => files.current.set(geoid, data))
          .catch(() => files.current.set(geoid, "failed"))
          .finally(() => setLoaded((x) => x + 1));
      }
      return null;
    },
    [artifactUrl],
  );

  const blockLot = BLOCK_LOT.test(query);
  const parsed = useMemo(() => (n && !blockLot ? parseQuery(query, n) : null), [n, blockLot, query]);
  const shardKey = parsed ? shardOf(parsed.street.join(" ")) : null;

  useEffect(() => {
    if (!shardKey || !meta || shard?.key === shardKey) return;
    if (!meta.shards.includes(shardKey)) {
      setShard({ key: shardKey, data: {} });
      return;
    }
    let live = true;
    fetch(`${artifactUrl}/parcels/streets/${shardKey}.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: StreetShard) => live && setShard({ key: shardKey, data }))
      .catch(() => live && setError("The street index could not be loaded."));
    return () => {
      live = false;
    };
  }, [shardKey, meta, shard, artifactUrl]);

  const hits: Hit[] = useMemo(() => {
    if (!parsed || !n || !meta || shard?.key !== shardKey) return [];
    const all = placesFor(matchStreets(shard.data, parsed, n), parsed, meta, n);
    return town ? all.filter((h) => h.geoid === town.geoid) : all;
  }, [parsed, n, meta, shard, shardKey, town]);

  // With a house number and only a few places it could be, look in all of them; with
  // more, or with no number, the reader picks a street and town first.
  const targets = picked ? [picked] : parsed?.number && hits.length <= FETCH_AT_ONCE ? hits : [];
  const found: Found[] = [];
  let waiting = false;
  if (n) {
    for (const hit of targets) {
      const file = fileOf(hit.geoid);
      if (!file) {
        waiting ||= files.current.get(hit.geoid) === "loading";
        continue;
      }
      const parcels = parcelsOf(file);
      for (const parcel of parcelsOn(parcels, hit.street, parsed?.number ?? null, n)) {
        found.push({ file, parcels, parcel });
      }
    }
  }

  // Block and lot: the chosen town's file, searched as Milestone 37 did.
  const townFile = town && blockLot ? fileOf(town.geoid) : null;
  const byLot = useMemo(() => {
    if (!townFile) return [];
    const parcels = parcelsOf(townFile);
    return search(parcels, query).map((parcel) => ({ file: townFile, parcels, parcel }));
  }, [townFile, query]);

  const place = (geoid: string) => {
    const [name, county] = meta?.towns[geoid] ?? [geoid, ""];
    return county ? `${name}, ${county} County` : name;
  };
  const results = blockLot ? byLot : found;
  const typed = query.trim() !== "";

  return (
    <div className="tax-lookup">
      <div className="household-inputs">
        <label className="control">
          <span className="control-label">Find a property</span>
          <span className="tax-search-field"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
          <input
            value={query}
            disabled={!meta}
            placeholder={meta ? "Street address, e.g. 100 Community Dr" : "Loading property records…"}
            aria-label="Address, or block and lot"
            onChange={(event) => {
              setQuery(event.target.value);
              if (BLOCK_LOT.test(event.target.value) && townFilter.current) townFilter.current.open = true;
              setPicked(null);
              setChosen(null);
            }}
          />
          </span>
          <span className="tax-search-hint">Results appear as you type. You can add a town or ZIP in this field.</span>
        </label>
        <details className="tax-town-filter" ref={townFilter}>
          <summary>{town ? `Only in ${label(town)}` : "Narrow to one town, or search by block & lot"} <span aria-hidden="true">＋</span></summary>
        <label className="control">
          <span className="control-label">Town · required for block &amp; lot, otherwise optional</span>
          <input
            list="tax-towns"
            value={townQuery}
            placeholder="Anywhere in New Jersey"
            aria-label="Town"
            onChange={(event) => {
              setTownQuery(event.target.value);
              setPicked(null);
              setChosen(null);
            }}
          />
          <datalist id="tax-towns">
            {towns.map((t) => (
              <option key={t.geoid} value={label(t)} />
            ))}
          </datalist>
        </label>
        {townQuery && <button type="button" className="tax-clear-town" onClick={() => { setTownQuery(""); setPicked(null); setChosen(null); }}>Clear town filter</button>}
        <p className="tax-search-hint">For block &amp; lot, enter numbers such as 2604/19 in the search above, then choose the town here.</p>
        </details>
      </div>

      {error && <p className="household-note">{error}</p>}
      {typed && blockLot && !town && (
        <p className="household-note">Block and lot numbers repeat from town to town: choose the town too.</p>
      )}

      {typed && !chosen && !blockLot && parsed && shard?.key === shardKey && (
        <>
          {hits.length === 0 && (
            <p className="household-note">
              {parsed.number
                ? `No ${parsed.number} on a street by that name${town ? ` in ${town.name}` : ""} in the state’s records.`
                : "No street by that name in the state’s records."}{" "}
              Try fewer words, or the street’s name alone to see where it is. About 196,000
              records — rear lots, land off a road — have no house number; find those by block
              and lot.
            </p>
          )}
          {hits.length > 0 && targets.length === 0 && (() => {
            const counts = new Map<string, number>();
            hits.forEach((hit) => counts.set(hit.street, (counts.get(hit.street) ?? 0) + 1));
            const common = [...counts].sort((a, b) => b[1] - a[1])[0][0];
            const byCounty = new Map<string, Hit[]>();
            hits.slice(0, 80).forEach((hit) => {
              const county = meta?.towns[hit.geoid]?.[1] ?? "";
              byCounty.set(county, [...(byCounty.get(county) ?? []), hit]);
            });
            const addressText = `${parsed.number ? `${parsed.number} ` : ""}${addressCase(common)}`;
            return (
              <div className="tax-places" aria-live="polite">
                <p className="tax-places-lead">
                  {hits.length === 1 ? <><b>{addressText}</b> is in one town:</> : <><b>{addressText}</b> is in {hits.length} towns.{parsed.zip || town ? " Pick one:" : " Pick one, or add the town or ZIP to your search."}</>}
                </p>
                {[...byCounty].sort((a, b) => a[0].localeCompare(b[0])).map(([county, group]) => (
                  <section key={county}>
                    <h3>{county ? `${county} County` : "New Jersey"}</h3>
                    <ul>
                      {group.sort((a, b) => place(a.geoid).localeCompare(place(b.geoid))).map((hit) => (
                        <li key={`${hit.street}-${hit.geoid}`}>
                          <button type="button" onClick={() => setPicked(hit)}>
                            {meta?.towns[hit.geoid]?.[0] ?? hit.geoid}
                            {hit.street !== common && <small>{addressCase(hit.street)}</small>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {typed && !chosen && (blockLot ? Boolean(townFile) : targets.length > 0) && (
        <ul className="tax-results" aria-live="polite">
          {results.length === 0 && !waiting && <li className="household-note">No property matches.</li>}
          {waiting && <li className="household-note">Loading the town’s property records…</li>}
          {results.slice(0, 60).map((r, i) => (
            <li key={`${r.file.geoid}-${r.parcel.block}-${r.parcel.lot}-${r.parcel.qualifier}-${i}`}>
              <button type="button" onClick={() => setChosen(r)}>
                {parcelName(r.parcel)}
                <small>
                  {place(r.file.geoid)} · {plainClass(r.file.classes[r.parcel.propertyClass] ?? `Class ${r.parcel.propertyClass}`)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <ParcelCard
          file={chosen.file}
          parcels={chosen.parcels}
          parcel={chosen.parcel}
          countyRecords={countyLookup(chosen.file.county ?? "", meta?.towns[chosen.file.geoid]?.[2] ?? "")}
          rate={rate}
          artifactUrl={artifactUrl}
        />
      )}

      <p className="household-note">
        Owner names are never shown or collected. A judge, prosecutor or police officer, or
        a member of their household, can ask for their home address to be taken off this
        lookup under New Jersey’s Daniel’s Law: write to{" "}
        <a href={`mailto:${REMOVAL_EMAIL}`}>{REMOVAL_EMAIL}</a> with the address and town.
        It is removed within ten business days.
      </p>
    </div>
  );
}

function ParcelCard({
  file,
  parcels,
  parcel,
  countyRecords,
  rate,
  artifactUrl,
}: {
  file: ParcelFile;
  parcels: Parcel[];
  parcel: Parcel;
  countyRecords: string | null;
  rate: { value: number; asOf: string } | null;
  artifactUrl: string;
}) {
  const town = file.municipality ?? "this town";
  const implied = impliedValue(parcel.assessed, file.assessment_ratio);
  const percentile = classPercentile(parcels, parcel);
  const className = plainClass(file.classes[parcel.propertyClass] ?? `Class ${parcel.propertyClass}`);
  const building = describeBuilding(parcel.building);
  const ratio = file.nj_director_ratio;
  const indicated = revaluationIndicated(ratio);
  const reval = file.nj_revaluation_year;

  const perMonth = parcel.tax === null ? null : Math.round(parcel.tax / 12);
  const exempt = parcel.tax === 0;

  return (
    <article className="household-panel tax-card tax-card-v2" aria-live="polite">
      <header className="tax-card-head">
        <h2 className="household-title">{parcel.address ? addressCase(parcel.address) : parcelName(parcel)}</h2>
        <p className="household-note">
          {parcel.address ? <>Block {parcel.block}, lot {parcel.lot}{parcel.qualifier ? `, ${parcel.qualifier}` : ""} · </> : null}
          {className} · {town}{file.county ? `, ${file.county} County` : ""}
        </p>
      </header>

      <div className="tax-hero">
        <p className="tax-hero-label">Property tax, {file.tax_year}</p>
        <p className="tax-hero-figure">{usd(parcel.tax)}<small> a year</small></p>
        <p className="tax-hero-sub">
          {exempt ? "No tax billed — this property is exempt." : perMonth !== null ? <>About <b>{usd(perMonth)}</b> a month, before any rebates or credits.</> : "Not in the state’s file for this year."}
        </p>
      </div>

      <dl className="tax-values">
        <div><dt>Assessed value</dt><dd>{usd(parcel.assessed)}</dd><small>what the tax is based on</small></div>
        <div><dt>Land + building</dt><dd>{usd(parcel.land)} <span>+</span> {usd(parcel.improvement)}</dd><small>how the assessor splits it</small></div>
        {implied !== null && file.assessment_ratio && <div><dt>Likely sale value</dt><dd>~{usd(Math.round(implied / 1000) * 1000)}</dd><small>a rough guess from how {town}’s values compare with sales — not an appraisal</small></div>}
      </dl>

      {percentile !== null && (
        <div className="tax-rank" style={{ ["--rank" as string]: `${percentile}%` }}>
          <p>Assessed higher than <b>{percentile}%</b> of similar properties in {town}</p>
          <span className="tax-rank-track" aria-hidden="true"><span /></span>
          <small>Compared only with the same kind of property ({className.toLowerCase()}), by assessed value.</small>
        </div>
      )}

      {parcel.building && (
        <p className="tax-building">
          <span>The building</span>
          {building ?? `assessor’s code “${parcel.building.trim()}”`}
        </p>
      )}

      <PropertyDetails
        parcel={parcel}
        geoid={file.geoid}
        town={town}
        likelyValue={implied !== null && file.assessment_ratio ? Math.round(implied / 1000) * 1000 : null}
        rate={rate}
        artifactUrl={artifactUrl}
      />

      <section className="tax-town" aria-labelledby="tax-town-heading">
        <h3 id="tax-town-heading">{town}’s assessments</h3>
        <dl className="tax-town-stats">
          <div>
            <dt>Values last reset</dt>
            <dd>{reval ? Math.round(reval.value) : "before 2017"}</dd>
          </div>
          {ratio && <div data-flag={indicated || undefined}>
            <dt>Values vs what homes sell for</dt>
            <dd>{Math.round(ratio.value)}%</dd>
            {indicated && <small>a town-wide reset is likely due</small>}
          </div>}
          {file.nj_general_tax_rate && <div>
            <dt>Tax rate, {file.nj_general_tax_rate.year}</dt>
            <dd>${file.nj_general_tax_rate.value.toFixed(2)}<small> per $100 of value</small></dd>
          </div>}
        </dl>
        <details className="tax-explain"><summary>What these mean</summary>
          <ul className="tax-context">
            <li>
              {reval
                ? `${town} last reset every property’s value to match the market for ${Math.round(reval.value)} (a revaluation or reassessment).`
                : `${town} hasn’t reset its property values to match the market since at least 2017, when the state’s records begin.`}
            </li>
            {ratio && <li>
              On average, {town}’s assessed values are {ratio.value.toFixed(1)}% of what homes actually sell for (the state’s {ratio.year} “Director’s Ratio”) — a town-wide figure, not one for this property.{" "}
              {indicated
                ? `Below ${REVALUATION_RATIO}%, the state usually expects a town to reset its values; the county tax board decides.`
                : `That’s above the ${REVALUATION_RATIO}% where the state usually expects a reset.`}
            </li>}
            {file.nj_general_tax_rate && file.nj_effective_tax_rate && <li>
              Bills are the tax rate times the assessed value: ${file.nj_general_tax_rate.value.toFixed(3)} for every $100. To compare towns fairly, use the “effective” rate, ${file.nj_effective_tax_rate.value.toFixed(3)} per $100 of sale value.
            </li>}
          </ul>
        </details>
      </section>

      <ul className="tax-next">
        <li><a href={APPEALS} target="_blank" rel="noreferrer"><b>Think the assessment is wrong?</b><span>Appeal to the {file.county ? `${file.county} County` : "county"} tax board by <strong>{appealDeadline(file.county).date}</strong> — {appealDeadline(file.county).note}.</span></a></li>
        {countyRecords && <li><a href={countyRecords} target="_blank" rel="noreferrer"><b>{file.county} County’s record</b><span>Can be newer than the state’s file</span></a></li>}
        <li><a href={CHAPTER_123} target="_blank" rel="noreferrer"><b>How appeals are judged</b><span>The state’s fair-value range for each town</span></a></li>
      </ul>
    </article>
  );
}
