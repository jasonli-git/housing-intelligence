"use client";

import { useEffect, useMemo, useState } from "react";

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

export type Town = { geoid: string; name: string; county: string };

const APPEALS = "https://www.nj.gov/treasury/taxation/lpt/lpt-appeal.shtml";
const CHAPTER_123 = "https://www.nj.gov/treasury/taxation/lpt/statdata.shtml";

function usd(value: number | null): string {
  return value === null ? "—" : formatValue(value, "usd");
}

function parcelName(parcel: Parcel): string {
  const where = `Block ${parcel.block}, lot ${parcel.lot}${parcel.qualifier ? `, ${parcel.qualifier}` : ""}`;
  return parcel.address ? `${parcel.address} · ${where}` : where;
}

/**
 * Find a property by address or block and lot, within a town (Milestone 37). The town's
 * file is fetched from object storage only once a town is chosen: 564 of them, a median
 * of about 3,200 parcels each, never pages.
 */
export function TaxLookup({ towns, artifactUrl }: { towns: Town[]; artifactUrl: string }) {
  const [townQuery, setTownQuery] = useState("");
  const [town, setTown] = useState<Town | null>(null);
  const [file, setFile] = useState<ParcelFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Parcel | null>(null);

  const label = (t: Town) => `${t.name}, ${t.county} County`;
  // A town page links here as `/tax?town=<geoid>`, choosing the town for the reader.
  useEffect(() => {
    const geoid = new URLSearchParams(window.location.search).get("town");
    const linked = towns.find((t) => t.geoid === geoid);
    if (linked) setTownQuery(label(linked));
  }, [towns]);
  useEffect(() => {
    const match = towns.find((t) => label(t).toLowerCase() === townQuery.trim().toLowerCase());
    if (match && match.geoid !== town?.geoid) setTown(match);
  }, [townQuery, towns, town]);

  useEffect(() => {
    if (!town) return;
    let live = true;
    setFile(null);
    setChosen(null);
    setError(null);
    fetch(`${artifactUrl}/parcels/${town.geoid}.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: ParcelFile) => live && setFile(data))
      .catch(() => live && setError(`The property records for ${town.name} could not be loaded.`));
    return () => {
      live = false;
    };
  }, [town, artifactUrl]);

  const parcels = useMemo(() => (file ? parcelsOf(file) : []), [file]);
  const results = useMemo(() => search(parcels, query), [parcels, query]);

  return (
    <div className="tax-lookup">
      <div className="household-inputs">
        <label className="control">
          <span className="control-label">Town</span>
          <input
            list="tax-towns"
            value={townQuery}
            placeholder="Start typing a town"
            aria-label="Town"
            onChange={(event) => setTownQuery(event.target.value)}
          />
          <datalist id="tax-towns">
            {towns.map((t) => (
              <option key={t.geoid} value={label(t)} />
            ))}
          </datalist>
        </label>
        <label className="control">
          <span className="control-label">Address, or block and lot</span>
          <input
            value={query}
            disabled={!file}
            placeholder={file ? "250 Lorraine Dr, or 2604/19" : "Choose a town first"}
            aria-label="Address, or block and lot"
            onChange={(event) => {
              setQuery(event.target.value);
              setChosen(null);
            }}
          />
        </label>
      </div>

      {town && !file && !error && <p className="household-note">Loading {town.name}’s property records…</p>}
      {error && <p className="household-note">{error}</p>}

      {file && !chosen && query.trim() !== "" && (
        <ul className="tax-results" aria-live="polite">
          {results.length === 0 && <li className="household-note">No property matches.</li>}
          {results.map((parcel, i) => (
            <li key={`${parcel.block}-${parcel.lot}-${parcel.qualifier}-${i}`}>
              <button type="button" onClick={() => setChosen(parcel)}>
                {parcelName(parcel)}
                <small>{file.classes[parcel.propertyClass] ?? `Class ${parcel.propertyClass}`}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {file && chosen && <ParcelCard file={file} parcels={parcels} parcel={chosen} />}
    </div>
  );
}

function ParcelCard({ file, parcels, parcel }: { file: ParcelFile; parcels: Parcel[]; parcel: Parcel }) {
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
          <dt>Assessed value</dt>
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
              Market value the state’s ratio implies
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
              Against the town’s {className.toLowerCase()}
              <small className="src">the same class only</small>
            </dt>
            <dd>assessed above {percentile}%</dd>
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
            Its Director’s Ratio for {ratio.year} is {ratio.value.toFixed(2)}%: assessments
            are about that share of market value.{" "}
            {indicated
              ? `At or below ${REVALUATION_RATIO}%, the state’s rules generally read that as calling for a revaluation; the county tax board decides.`
              : `Above the ${REVALUATION_RATIO}% at which the state’s rules generally call for a revaluation.`}
          </li>
        )}
        {file.nj_general_tax_rate && file.nj_effective_tax_rate && (
          <li>
            Its {file.nj_general_tax_rate.year} tax rate is {file.nj_general_tax_rate.value.toFixed(3)}{" "}
            per $100 of assessed value — {file.nj_effective_tax_rate.value.toFixed(3)} per $100 of
            market value, the effective rate.
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
        . Owner names are not shown, and never collected.
      </p>
    </article>
  );
}
