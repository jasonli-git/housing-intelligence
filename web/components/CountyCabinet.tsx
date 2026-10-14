"use client";

import { useRef } from "react";
import Link from "next/link";
import type { CountyDestination } from "@/lib/countyPicker";
import { regionPath } from "@/lib/placeRoutes";

// A reading aid, not an official division: the loose North / Central / South split New
// Jerseyans use. A county not listed here falls into "Other" rather than disappearing.
const REGIONS: { name: string; counties: string[] }[] = [
  { name: "North", counties: ["Bergen", "Essex", "Hudson", "Morris", "Passaic", "Sussex", "Union", "Warren"] },
  { name: "Central", counties: ["Hunterdon", "Mercer", "Middlesex", "Monmouth", "Somerset"] },
  { name: "South", counties: ["Atlantic", "Burlington", "Camden", "Cape May", "Cumberland", "Gloucester", "Ocean", "Salem"] },
];

/** Every county at once, grouped loosely by region; each is a direct destination. Arrow
 * keys, Home and End move across the whole list, as the strip they replace did. */
export function CountyCabinet({ counties }: { counties: CountyDestination[] }) {
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  if (!counties.length) return null;
  const short = (name: string) => name.replace(/ County$/, "");
  const placed = new Set(REGIONS.flatMap((r) => r.counties));
  const groups = [
    ...REGIONS.map((r) => ({ name: r.name, items: counties.filter((c) => r.counties.includes(short(c.name))) })),
    { name: "Other", items: counties.filter((c) => !placed.has(short(c.name))) },
  ].filter((g) => g.items.length);
  const order = groups.flatMap((g) => g.items);
  return <nav className="county-index" aria-label="Explore New Jersey counties" id="state-county-navigation" data-jump-label="Explore counties">
    <div className="county-index-head">
      <h2>Counties</h2>
      <p>All {counties.length}, grouped loosely by region. Pick one for its own page.</p>
    </div>
    <div className="county-index-groups">
      {groups.map((group) => <section key={group.name} className="county-index-group" aria-label={`${group.name} Jersey counties`}>
        <h3>{group.name}<span>{group.items.length}</span></h3>
        <ul>
          {group.items.map((county) => {
            const index = order.indexOf(county);
            return <li key={county.id}><Link className="destination-county county-index-link" href={regionPath(county.id)}
              ref={(node) => { links.current[index] = node; }} aria-label={`Explore ${county.name}`}
              onKeyDown={(event) => {
                const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(index + 1, order.length - 1)
                  : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(index - 1, 0)
                  : event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : null;
                if (next !== null) { event.preventDefault(); links.current[next]?.focus(); }
              }}><span>{short(county.name)}</span><i aria-hidden="true">→</i></Link></li>;
          })}
        </ul>
      </section>)}
    </div>
  </nav>;
}
