"use client";
import { useState } from "react";
import Link from "next/link";
import { regionPath } from "@/lib/placeRoutes";

export function CountyPlaces({ name, towns }: { name: string; towns: { id: number; name: string }[] }) {
  const [query, setQuery] = useState("");
  const matching = towns.filter(t => t.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="county-place-directory" id="county-places" data-jump-label="Explore towns" aria-labelledby="county-places-title">
    <h2 id="county-places-title">Explore places in {name}</h2>
    <label htmlFor="county-town-search">Find a town in this county</label>
    <input id="county-town-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Town name" />
    <nav aria-label={`Towns in ${name}`} className="county-town-links">{matching.slice(0, query ? matching.length : 6).map(t => <Link className="destination-town" key={t.id} href={regionPath(t.id)}>{t.name} ↗</Link>)}</nav>
    {!matching.length && <p>No matching town in this directory.</p>}
    {!query && matching.length > 6 && <details><summary>Browse all {towns.length} towns</summary><nav className="county-town-links" aria-label="More towns">{matching.slice(6).map(t => <Link className="destination-town" key={t.id} href={regionPath(t.id)}>{t.name} ↗</Link>)}</nav></details>}
    <p className="table-note">Browse places here; use Find your fit to compare them against your budget. ZIP areas may cross counties—use the global search for ZIP profiles.</p>
  </section>;
}
