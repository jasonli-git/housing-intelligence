import { Term } from "@/components/Term";
import { scopeName } from "@/lib/names";
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
        <h2 id="similar-places-heading">Somewhere like here, but cheaper?</h2>
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
          ? "Prices are Zillow’s typical single-family home value, an estimate, not recorded sales: sales are filed by town, so no ZIP code has a sale price. ZIP codes are compared only with ZIP codes."
          : <>Prices are the median recorded sale{window ? `, ${window}` : ""}, in towns with at least {data.min_sales} sales.</>}
      </p>

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
                  <tr key={row.metric_id}>
                    <th scope="row"><Term id={row.metric_id}>{row.label}</Term></th>
                    {row.values.map((v, i) => (
                      <td className="num" key={places[i].region_id}>
                        {v === null ? "—" : formatMetric(v, row.unit, row.metric_id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
