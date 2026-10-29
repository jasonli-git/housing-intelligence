import { Term } from "@/components/Term";
import { scopeName } from "@/lib/names";
import { MAX_PLACES, placesQuery } from "@/lib/compare";
import { regionPath } from "@/lib/placeRoutes";
import Link from "next/link";

import type { SimilarPlaces as SimilarPlacesData } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { priceWindow, similarGroups } from "@/lib/similar";

const COUNTS = ["", "one", "two", "three", "four", "five"];

/**
 * Somewhere like here, but cheaper (Milestone 46, ARCHITECTURE #317)? The towns most like
 * this one on four named measures whose homes sold for at least 10% less, set side by side
 * with it. What the page owes a reader: "like here" means only the measures listed; the
 * price is one recorded-sales measure for every town; and where no town is near enough,
 * it says so instead of listing the least unlike.
 */
export function SimilarPlaces({ name, state, data }: { name: string; state: string; data: SimilarPlacesData | null }) {
  if (!data) return null;
  const groups = similarGroups(data);
  const allRows = groups.flatMap((g) => g.rows);
  const priceRow = allRows.find((r) => r.metric_id === data.price);
  const commuteRow = allRows.find((r) => r.metric_id === data.commute);
  const taxRow = allRows.find((r) => r.metric_id === "nj_effective_tax_rate");
  const window = priceWindow(data);
  const measures = groups[0].rows.map((r) => r.label.toLowerCase());
  const cheaper = Math.round((1 - data.cheaper_by) * 100);
  const places = [data.here, ...data.matches];
  // ZIP codes are compared with ZIP codes on Zillow's typical value; towns with towns on
  // recorded sales (#394). The words follow.
  const zip = data.level === "zip";
  const noun = zip ? "ZIP code" : "town";
  const nouns = zip ? "ZIP codes" : "towns";
  const cheaperWords = zip ? `typical home value is at least ${cheaper}% lower` : `homes sold for at least ${cheaper}% less`;

  return (
    <section className="section sales similar-places" aria-labelledby="similar-places-heading">
      <div className="section-head">
        <h2 id="similar-places-heading">Similar cheaper places</h2>
      </div>

      <p className="sales-lead">
        {data.matches.length > 0 ? (
          <>
            The {data.matches.length === 1 ? noun : `${COUNTS[data.matches.length]} ${nouns}`} most like {name}
            {" "}whose {cheaperWords}, with workers commuting no more than{" "}
            {data.commute_minutes} minutes longer.
          </>
        ) : (
          <>
            No {scopeName(state)} {noun} is close enough to {name} on these measures with a{" "}
            {zip ? `typical home value at least ${cheaper}% lower` : `median sale at least ${cheaper}% lower`} and a commute no more than{" "}
            {data.commute_minutes} minutes longer. The page does not loosen the rules to fill the list.
          </>
        )}
      </p>
      <p className="sales-note">
        “Like here” means only {measures.slice(0, -1).join(", ")} and {measures.at(-1)}: not
        schools, safety or anything else.{" "}
        {zip
          ? "Prices are Zillow’s typical home value, an estimate, not recorded sales: sales are filed by town, so no ZIP code has a sale price. ZIP codes are compared only with ZIP codes."
          : <>Prices are the median recorded sale{window ? `, ${window}` : ""}, in towns with at least {data.min_sales} sales.</>}
      </p>

      <p className="similar-compare">
        <Link href={`/compare${placesQuery(places.slice(0, MAX_PLACES).map((p) => p.region_id))}`}>
          {data.matches.length > 0 ? "Compare these side by side" : `Compare ${name} with another place`} <span aria-hidden="true">→</span>
        </Link>
      </p>

      {/* Destination cards (2026-10-29): each match's price and what it saves against here,
          the commute and tax beside it; the table below is the evidence. */}
      {data.matches.length > 0 && priceRow && <ul className="similar-destinations" aria-label={`Cheaper ${nouns} like ${name}`}>
        {data.matches.map((m, i) => {
          const here = priceRow.values[0], there = priceRow.values[i + 1];
          const commuteHere = commuteRow?.values[0] ?? null, commuteThere = commuteRow?.values[i + 1] ?? null;
          const tax = taxRow?.values[i + 1] ?? null;
          return <li key={m.region_id}><Link href={regionPath(m.region_id)} className="similar-destination">
            <span className="similar-destination-name">{m.name}</span>
            {there !== null && <span className="similar-destination-price">{formatMetric(there, priceRow.unit, priceRow.metric_id)}</span>}
            {here !== null && there !== null && here > there && <span className="similar-destination-saving"><b>{formatMetric(here - there, priceRow.unit, priceRow.metric_id)} less</b> · −{Math.round((1 - there / here) * 100)}%</span>}
            <span className="similar-destination-chips">
              {commuteHere !== null && commuteThere !== null && <span>Commute {commuteThere - commuteHere >= 0 ? "+" : "−"}{Math.abs(commuteThere - commuteHere).toFixed(1)} min</span>}
              {tax !== null && taxRow && <span>Tax {formatMetric(tax, taxRow.unit, taxRow.metric_id)}</span>}
            </span>
          </Link></li>;
        })}
      </ul>}

      {data.matches.length > 0 && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
          <table className="change-places similar-table">
            <caption className="visually-hidden">
              {name} beside the {nouns} most like it, and cheaper
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Measure</span>
                </th>
                {places.map((p, i) => (
                  <th scope="col" className="num" key={p.region_id}>
                    {i === 0 ? p.name : <Link className={zip ? "destination-zip" : "destination-town"} href={regionPath(p.region_id)}>{p.name}</Link>}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.key}>
                <tr className="similar-group">
                  <th scope="rowgroup" colSpan={places.length + 1}>
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.metric_id} data-similar-row={row.metric_id === data.price ? "price" : undefined}>
                    <th scope="row"><Term id={row.metric_id}>{row.label}</Term></th>
                    {row.values.map((v, i) => (
                      <td className="num" key={places[i].region_id}>
                        {v === null ? "—" : formatMetric(v, row.unit, row.metric_id)}
                        {group.key === "matched" && i > 0 && <Closeness here={row.values[0]} there={v} unit={row.unit} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {data.matches.length > 0 && <p className="sales-note similar-closeness-key"><i className="similar-closeness" data-close="near" aria-hidden="true" /> within 3 points of {name} · <i className="similar-closeness" data-close="mid" aria-hidden="true" /> within 8 · <i className="similar-closeness" data-close="far" aria-hidden="true" /> further, on each matched share.</p>}
    </section>
  );
}

/** How near a match is to here on one matched share: within 3 points, within 8, or more. */
function Closeness({ here, there, unit }: { here: number | null; there: number | null; unit: string }) {
  if (here === null || there === null || unit !== "ratio") return null;
  const points = Math.abs(there - here) * 100;
  const level = points <= 3 ? "near" : points <= 8 ? "mid" : "far";
  return <i className="similar-closeness" data-close={level} title={`${points.toFixed(1)} points from here`} aria-hidden="true" />;
}
