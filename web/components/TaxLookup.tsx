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
import { countyLookup } from "@/lib/countyLookups";
import { formatValue } from "@/lib/format";
import {
  classPercentile,
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

function parcelName(parcel: Parcel): string {
  const where = `Block ${parcel.block}, lot ${parcel.lot}${parcel.qualifier ? `, ${parcel.qualifier}` : ""}`;
  return parcel.address ? `${parcel.address} · ${where}` : where;
}

type Found = { file: ParcelFile; parcels: Parcel[]; parcel: Parcel };

/**
 * Find any property in New Jersey from one typed address (Milestone 38). The street
 * index names the towns that have the street and the house number; only those towns'
 * files are fetched, and only up to `FETCH_AT_ONCE` before the reader is asked to choose.
 * A block and lot still takes a town, since those numbers repeat across the state.
 */
export function TaxLookup({ towns, artifactUrl }: { towns: Town[]; artifactUrl: string }) {
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
          <summary>{town ? `Town filter: ${label(town)}` : "Town filter or block & lot"} <span aria-hidden="true">＋</span></summary>
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
          {hits.length > 0 && targets.length === 0 && (
            <ul className="tax-results" aria-live="polite">
              <li className="household-note">
                {hits.length === 1
                  ? "One place has it:"
                  : `${hits.length} places have it${parsed.zip || town ? "" : " — add the town or ZIP to narrow them"}. Choose one:`}
              </li>
              {hits.slice(0, 40).map((hit) => (
                <li key={`${hit.street}-${hit.geoid}`}>
                  <button type="button" onClick={() => setPicked(hit)}>
                    {parsed.number ? `${parsed.number} ` : ""}
                    {hit.street}
                    <small>{place(hit.geoid)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                  {place(r.file.geoid)} · {r.file.classes[r.parcel.propertyClass] ?? `Class ${r.parcel.propertyClass}`}
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
}: {
  file: ParcelFile;
  parcels: Parcel[];
  parcel: Parcel;
  countyRecords: string | null;
}) {
  const town = file.municipality ?? "this town";
  const implied = impliedValue(parcel.assessed, file.assessment_ratio);
  const percentile = classPercentile(parcels, parcel);
  const className = file.classes[parcel.propertyClass] ?? `Class ${parcel.propertyClass}`;
  const ratio = file.nj_director_ratio;
  const indicated = revaluationIndicated(ratio);
  const reval = file.nj_revaluation_year;

  return (
    <article className="household-panel tax-card" aria-live="polite">
      <h2 className="household-title">{parcelName(parcel)}</h2>
      <p className="household-note">
        {className}, {town}
        {file.county ? `, ${file.county} County` : ""} · tax year {file.tax_year}
      </p>
      <dl className="cost-lines">
        <div className="sum">
          <dt>Value used to calculate property tax<small className="src">Assessed value · the assessor’s recorded value, not necessarily today’s sale price</small></dt>
          <dd>{usd(parcel.assessed)}</dd>
        </div>
        <div>
          <dt>
            Land, and the improvements on it
            <small className="src">as the town’s assessor values them</small>
          </dt>
          <dd>
            {usd(parcel.land)} + {usd(parcel.improvement)}
          </dd>
        </div>
        <div className="sum">
          <dt>
            Last year’s tax
            <small className="src">MOD-IV, tax year {file.tax_year}, before any relief</small>
          </dt>
          <dd>{usd(parcel.tax)}</dd>
        </div>
        {implied !== null && file.assessment_ratio && (
          <div>
            <dt>
              Rough market-value estimate from the town’s ratio
              <small className="src">
                at {town}’s {file.assessment_ratio.value.toFixed(2)}% Director’s Ratio for{" "}
                {file.assessment_ratio.year} — the state’s method, not an appraisal
              </small>
            </dt>
            <dd>about {usd(Math.round(implied / 1000) * 1000)}</dd>
          </div>
        )}
        {percentile !== null && (
          <div>
            <dt>
              Compared with {className.toLowerCase()} properties in {town}
              <small className="src">Tax assessments—not home quality or sale prices</small>
            </dt>
            <dd>Higher assessed value than {percentile}%</dd>
          </div>
        )}
        {(parcel.yearBuilt || parcel.dwellings || parcel.building) && (
          <div>
            <dt>
              The building
              <small className="src">the assessor’s description</small>
            </dt>
            <dd>
              {[
                parcel.yearBuilt ? `built ${parcel.yearBuilt}` : null,
                parcel.dwellings ? `${parcel.dwellings} ${parcel.dwellings === 1 ? "home" : "homes"}` : null,
                parcel.building,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
      </dl>

      <h3 className="household-title">{town}’s assessments</h3>
      <ul className="tax-context">
        <li>
          {reval
            ? `Last revalued or reassessed for tax year ${Math.round(reval.value)}.`
            : "Not revalued or reassessed since at least 2017, when the state’s lists begin."}
        </li>
        {ratio && (
          <li>
            <strong>How assessments compare with market values:</strong> {town}’s {ratio.year} Director’s Ratio is {ratio.value.toFixed(2)}%. Town-wide assessed values average about that share of market values—not a valuation of this particular home.{" "}
            {indicated
              ? `At or below ${REVALUATION_RATIO}%, the state’s rules generally read that as calling for a revaluation; the county tax board decides.`
              : `Above the ${REVALUATION_RATIO}% at which the state’s rules generally call for a revaluation.`}
          </li>
        )}
        {file.nj_general_tax_rate && file.nj_effective_tax_rate && (
          <li>
            Tax rates for {file.nj_general_tax_rate.year}: ${file.nj_general_tax_rate.value.toFixed(3)} per $100 of assessed value (used to calculate bills); ${file.nj_effective_tax_rate.value.toFixed(3)} per $100 of equalized value (the effective rate, for comparing towns—not calculating this bill).
          </li>
        )}
      </ul>
      <p className="household-note">
        Think an assessment is wrong? Appeals go to the county board of taxation, usually by
        1 April (15 January in Burlington, Gloucester and Monmouth).{" "}
        <a href={APPEALS} target="_blank" rel="noreferrer">
          How appeals work
        </a>
        {" · "}
        <a href={CHAPTER_123} target="_blank" rel="noreferrer">
          The state’s common level ranges (Chapter 123)
        </a>
        .
      </p>
      {countyRecords && (
        <p className="household-note">
          The county’s own record may be newer than the state’s file:{" "}
          <a href={countyRecords} target="_blank" rel="noreferrer">
            {file.county} County’s property records
          </a>
          .
        </p>
      )}
    </article>
  );
}
