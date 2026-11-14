"use client";

import { useEffect, useState } from "react";

import type { Packet, PacketLevel } from "@/lib/api";
import { formatValue } from "@/lib/format";
import type { Parcel } from "@/lib/parcels";
import { periodLabel } from "@/lib/periods";
import { fullPath, placeIdOf, regionPath } from "@/lib/placeRoutes";

/** One-to-four-family homes: the class whose lot size is checked for plausibility. */
const HOMES = "2";
const SQ_FT_PER_ACRE = 43_560;
// Above this a home's lot is the parcel map's error, not a lot: 99.9% of New Jersey's
// homes sit on under 57 acres, and 1,315 read over 1,000 (#427).
const PLAUSIBLE_HOME_ACRES = 100;

const usd = (value: number) => formatValue(value, "usd");

/**
 * The fuller property page (ARCHITECTURE #427, the Zillow-parity Director Note): the lot
 * and the town's figures around it. What owning it would cost and renting nearby left on
 * 2026-11-12 (#516): they answered a shopper, not someone studying the place. Everything but the lot is the town's,
 * read from its published packet, and says so; nothing here is a figure about the owner,
 * and the home's own sales are left out until the Daniel's Law question is settled.
 */
export function PropertyDetails({
  parcel,
  geoid,
  town,
  artifactUrl,
}: {
  parcel: Parcel;
  geoid: string;
  town: string;
  artifactUrl: string;
}) {
  const placeId = placeIdOf("municipality", geoid);
  const [packet, setPacket] = useState<Packet | null>(null);
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
  // Section anchors are on the full page, which a town's address no longer shows (#520).
  const page = placeId === null ? null : fullPath(placeId);

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

      {page && (
        <section aria-labelledby="property-around">
          <h3 id="property-around">Around this home</h3>
          <p className="household-note">{town}’s figures, not this lot’s. Each opens the town page at the part that covers it.</p>
          <ul className="property-around">
            <li>
              <a href={`${page}#values`}>
                <span>Prices</span>
                <b>{typical ? `Typical home ${usd(typical.value)}` : "Home prices"}{starter ? ` · starter home ${usd(starter.value)}` : ""}</b>
                <small>{sale ? `Median sale ${usd(sale.value)}, sales through ${periodLabel(sale.period_end, sale.metric_id)} →` : "What homes sell for →"}</small>
              </a>
            </li>
            <li>
              <a href={`${page}#area`}>
                <span>Flood risk</span>
                <b>{flood ? `${(flood.value * 100).toFixed(1)}% of ${town}’s homes are in a flood zone` : "Flood zones and claims"}</b>
                <small>FEMA’s map in force; check this lot’s own zone →</small>
              </a>
            </li>
            <li>
              <a href={`${page}#area`}>
                <span>Drinking water</span>
                <b>Who supplies {town}’s water</b>
                <small>Violations on record and lead lines →</small>
              </a>
            </li>
            <li>
              <a href={`${page}#area`}>
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
