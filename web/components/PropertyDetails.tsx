"use client";

import { useEffect, useState } from "react";

import type { Packet, PacketLevel } from "@/lib/api";
import { costToOwn, DOWN_PAYMENTS, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import { writeGuideTransfer } from "@/lib/guideTransfer";
import type { Parcel } from "@/lib/parcels";
import { periodLabel } from "@/lib/periods";
import { placeIdOf, regionPath } from "@/lib/placeRoutes";

/** One-to-four-family homes: the class the cost of owning and renting are about. */
const HOMES = "2";
const SQ_FT_PER_ACRE = 43_560;
// Above this a home's lot is the parcel map's error, not a lot: 99.9% of New Jersey's
// homes sit on under 57 acres, and 1,315 read over 1,000 (#427).
const PLAUSIBLE_HOME_ACRES = 100;

const usd = (value: number) => formatValue(value, "usd");

/**
 * The fuller property page (ARCHITECTURE #427, the Zillow-parity Director Note): the lot,
 * what owning this home would cost at its likely value and actual tax bill, what renting
 * nearby costs, and the town's figures around it. Everything but the lot is the town's,
 * read from its published packet, and says so; nothing here is a figure about the owner,
 * and the home's own sales are left out until the Daniel's Law question is settled.
 */
export function PropertyDetails({
  parcel,
  geoid,
  town,
  likelyValue,
  rate,
  artifactUrl,
}: {
  parcel: Parcel;
  geoid: string;
  town: string;
  likelyValue: number | null;
  rate: { value: number; asOf: string } | null;
  artifactUrl: string;
}) {
  const placeId = placeIdOf("municipality", geoid);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [down, setDown] = useState<number>(10);
  useEffect(() => {
    if (placeId === null) return;
    let live = true;
    fetch(`${artifactUrl}/regions/${placeId}/packet/5y.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Packet | null) => live && setPacket(body))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [placeId, artifactUrl]);

  const level = (id: string): PacketLevel | undefined => packet?.levels.find((l) => l.metric_id === id);
  const home = parcel.propertyClass === HOMES;
  const page = placeId === null ? null : regionPath(placeId);

  const insurance = level("acs_median_home_insurance");
  const own =
    home && likelyValue && rate
      ? costToOwn({ homeValue: likelyValue, ratePct: rate.value, downPct: down, annualTax: parcel.tax })
      : null;
  const insuranceMonth = insurance ? insurance.value / 12 : null;

  const rents = [
    ["1 bedroom", level("acs_median_rent_1br")],
    ["2 bedrooms", level("acs_median_rent_2br")],
    ["3 bedrooms", level("acs_median_rent_3br")],
  ].filter((r): r is [string, PacketLevel] => Boolean(r[1]));
  const asking = level("zori_all");

  const typical = level("zhvi_sfr");
  const starter = level("zhvi_bottom_tier");
  const sale = level("sr1a_median_sale_price");
  const flood = level("fema_flood_homes_share");

  const acres =
    parcel.acres && (parcel.propertyClass !== HOMES || parcel.acres <= PLAUSIBLE_HOME_ACRES)
      ? parcel.acres
      : null;
  const lot = [
    acres
      ? { label: "Lot", value: `${acres.toFixed(acres < 1 ? 2 : 1)} acres`, note: `about ${Math.round(acres * SQ_FT_PER_ACRE).toLocaleString("en-US")} sq ft, from the parcel map` }
      : null,
    parcel.yearBuilt ? { label: "Built", value: String(parcel.yearBuilt), note: "as the assessor records it" } : null,
    parcel.dwellings ? { label: "Homes on it", value: String(parcel.dwellings), note: parcel.dwellings === 1 ? "one dwelling on the lot" : "dwellings on the lot" } : null,
  ].filter((x): x is { label: string; value: string; note: string } => x !== null);

  return (
    <div className="property-details">
      {lot.length > 0 && (
        <section aria-labelledby="property-lot">
          <h3 id="property-lot">The lot and the building</h3>
          <dl className="property-tiles">
            {lot.map((tile) => (
              <div key={tile.label}><dt>{tile.label}</dt><dd>{tile.value}</dd><small>{tile.note}</small></div>
            ))}
          </dl>
          <p className="household-note">
            {!acres && parcel.qualifier ? "A unit like this one shares its building’s lot, so it has no lot size of its own. " : ""}
            Bedrooms, bathrooms and floor area are not in New Jersey’s public assessment list.
          </p>
        </section>
      )}

      {own && (
        <section aria-labelledby="property-own">
          <h3 id="property-own">What owning it would cost</h3>
          <p className="household-note">Priced at this home’s likely sale value, {usd(likelyValue!)}, with its actual tax bill rather than {town}’s typical one.</p>
          <div className="property-downs" role="group" aria-label="Down payment">
            {DOWN_PAYMENTS.filter((d) => d !== 25).map((d) => (
              <button key={d} type="button" aria-pressed={down === d} onClick={() => setDown(d)}>{d}% down</button>
            ))}
          </div>
          <p className="property-month"><b>{usd(Math.round(own.total + (insuranceMonth ?? 0)))}</b> a month, including principal</p>
          <dl className="property-lines">
            <div><dt>Mortgage, at {rate!.value.toFixed(2)}% ({rate!.asOf})</dt><dd>{usd(Math.round(own.mortgage))}</dd></div>
            {own.tax !== null && <div><dt>Property tax, this home’s</dt><dd>{usd(Math.round(own.tax))}</dd></div>}
            {insuranceMonth !== null && <div><dt>Insurance, {town}’s typical</dt><dd>{usd(Math.round(insuranceMonth))}</dd></div>}
          </dl>
          <p className="household-note">
            Upfront: {usd(Math.round(own.down))} down, before closing costs. Calculated estimate, not a lender quote; it leaves out {leftOut(down).filter((part) => insuranceMonth === null || part !== "homeowners insurance").join(", ")}.
            {placeId !== null && (
              <>
                {" "}
                <a
                  href={`/guide?place=${placeId}`}
                  onClick={() => writeGuideTransfer(placeId, { price: likelyValue!, taxYear: parcel.tax ?? undefined }, asking?.value ?? null)}
                >
                  Fine-tune in the buyer’s guide →
                </a>
              </>
            )}
          </p>
        </section>
      )}

      {home && (rents.length > 0 || asking) && (
        <section aria-labelledby="property-rent">
          <h3 id="property-rent">Renting nearby instead</h3>
          <p className="household-note">This home’s size isn’t public, so here is what {town}’s renters pay by size.</p>
          <dl className="property-tiles">
            {rents.map(([label, row]) => (
              <div key={label}><dt>{label}</dt><dd>{usd(row.value)}</dd><small>a month, the Census’s five-year survey to {row.period_end.slice(0, 4)}</small></div>
            ))}
            {asking && <div><dt>Asking now</dt><dd>{usd(asking.value)}</dd><small>Zillow’s typical asking rent, {periodLabel(asking.period_end, asking.metric_id)}</small></div>}
          </dl>
          <p className="household-note">Survey figures carry margins of error, shown on {town}’s page.</p>
        </section>
      )}

      {page && (
        <section aria-labelledby="property-around">
          <h3 id="property-around">Around this home</h3>
          <p className="household-note">{town}’s figures, not this lot’s. Each opens the town page at that section.</p>
          <ul className="property-around">
            <li>
              <a href={`${page}#sales-heading`}>
                <span>Prices</span>
                <b>{typical ? `Typical home ${usd(typical.value)}` : "Home prices"}{starter ? ` · starter home ${usd(starter.value)}` : ""}</b>
                <small>{sale ? `Median sale ${usd(sale.value)}, sales through ${periodLabel(sale.period_end, sale.metric_id)} →` : "What homes sell for →"}</small>
              </a>
            </li>
            <li>
              <a href={`${page}#flood-risk-heading`}>
                <span>Flood risk</span>
                <b>{flood ? `${(flood.value * 100).toFixed(1)}% of ${town}’s homes are in a flood zone` : "Flood zones and claims"}</b>
                <small>FEMA’s map in force; check this lot’s own zone →</small>
              </a>
            </li>
            <li>
              <a href={`${page}#ground-water-heading`}>
                <span>Drinking water</span>
                <b>Who supplies {town}’s water</b>
                <small>Violations on record and lead lines →</small>
              </a>
            </li>
            <li>
              <a href={`${page}#community-schools-heading`}>
                <span>Schools</span>
                <b>{town}’s school district</b>
                <small>Test results and spending, from the state →</small>
              </a>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
