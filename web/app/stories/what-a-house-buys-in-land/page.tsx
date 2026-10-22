import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyShapes, storyTowns } from "@/lib/storyData";
import { PRICE } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "What a house buys in land — Housing",
  description: "The typical New Jersey home's value for each acre of its lot, town by town.",
  path: "/stories/what-a-house-buys-in-land",
});

const MAP_W = 560;
/** Smaller median lots than this (under about 900 square feet) are records, not yards: Monroe township's reads 0.0006 acres. */
const MIN_LOT = 0.02;
const usd = (v: number) => formatValue(v, "usd");
/** Dollars an acre, rounded to what a reader compares: $26.0M, $74k. */
const acre = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);
/** Fifths of the towns, lightest the least per acre; one hue, darker is dearer. */
const SHADES = [0.15, 0.32, 0.5, 0.7, 0.92];

export default async function WhatAHouseBuysInLandPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "modiv_median_lot_acres"]), storyShapes("municipality", MAP_W)]);
  const rows = towns
    .filter((t) => t.values[PRICE] && (t.values.modiv_median_lot_acres ?? 0) >= MIN_LOT)
    .map((t) => ({ t, acres: t.values.modiv_median_lot_acres!, perAcre: t.values[PRICE]! / t.values.modiv_median_lot_acres! }))
    .sort((a, b) => b.perAcre - a.perAcre);
  const sorted = rows.map((r) => r.perAcre).sort((a, b) => a - b);
  const breaks = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * sorted.length)]);
  const fifth = (v: number) => breaks.filter((b) => v >= b).length;
  const byId = new Map(rows.map((r) => [r.t.id, r]));
  const top = rows.slice(0, 10), bottom = rows.slice(-10).reverse();
  const bar = (list: typeof rows) => {
    const max = Math.max(...list.map((r) => r.perAcre));
    return (
      <ul className="count-bars">
        {list.map((r) => (
          <li key={r.t.id}>
            <span><Link href={regionPath(r.t.id)}>{r.t.name}</Link></span>
            <span className="bar-line"><i style={{ width: `${Math.round((r.perAcre / max) * 1000) / 10}%`, background: "var(--story-1)" }} />{acre(r.perAcre)}</span>
            <small>{usd(r.t.values[PRICE]!)} home on {r.acres < 0.1 ? r.acres.toFixed(2) : r.acres.toFixed(1)} acres</small>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <StoryShell
      title="What a house buys in land"
      lede={<>Divide the typical home&rsquo;s value by its typical lot and you get what a home costs for each acre it sits on. In {top[0]?.t.name} that is {acre(top[0]?.perAcre ?? 0)} an acre; in {bottom[0]?.t.name}, {acre(bottom[0]?.perAcre ?? 0)}. Darker towns on the map pay more for every acre.</>}
      note={<>Home value: Zillow&rsquo;s typical home value. Lot: the median lot of residential parcels on the state&rsquo;s tax list (MOD-IV); condominium units have no lot of their own and are left out of it. The figure prices the house and the land together, so it is a measure of how much ground a home&rsquo;s price comes with, not the price of land alone. {rows.length} towns have both; a median lot under {MIN_LOT} acres is left out as a recording quirk.</>}
    >
      <div className="story-two">
        <figure className="story-figure">
          <p className="ladder-key">
            {SHADES.map((o, i) => <span key={o}><i style={{ background: "var(--story-1)", opacity: o }} />{i === 0 ? `under ${acre(breaks[0])}` : i === 4 ? `${acre(breaks[3])}+` : `${acre(breaks[i - 1])}–${acre(breaks[i])}`}</span>)}
          </p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by home value per acre of lot. The dearest and cheapest are listed beside it.">
            {map.shapes.map((s) => {
              const r = byId.get(s.id);
              return <path key={s.id} d={s.d} className={`town ${r ? "seq" : "muted"}`} fillOpacity={r ? SHADES[fifth(r.perAcre)] : 1}><title>{r ? `${r.t.name}: ${acre(r.perAcre)} an acre` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <div>
          <h2 className="story-h">Most per acre</h2>
          {bar(top)}
          <h2 className="story-h">Least per acre</h2>
          {bar(bottom)}
        </div>
      </div>
    </StoryShell>
  );
}
