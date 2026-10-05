"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { matchingCounties, type CountyDestination } from "@/lib/countyPicker";

/** Direct page navigation, independent of the map's current measure/coverage. */
export function CountyPicker({ counties }: { counties: CountyDestination[] }) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const matches = matchingCounties(counties, query);
  return <details className="county-picker" ref={ref} onKeyDown={(event) => {
    if (event.key === "Escape" && ref.current?.open) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
  }}>
    <summary><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h6v5H3zM12 4h5v5h-5zM3 12h6v4H3zM12 12h5v4h-5z" /></svg><span>Explore counties</span><span className="county-picker-count">{counties.length}</span><span className="county-picker-chevron" aria-hidden="true">⌄</span></summary>
    <div className="county-picker-panel">
      <div className="county-picker-search"><label htmlFor={id}>Find a county</label>
        <input id={id} type="search" placeholder="County name" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className="county-picker-hint">Open a county for costs, local conditions and the full picture.</p>
      <ul>{matches.map((county) => <li key={county.id}><Link href={`/regions/${county.id}`}><span>{county.name.replace(/ County$/, "")}</span><span aria-hidden="true">↗</span></Link></li>)}</ul>
      {matches.length === 0 && <p role="status">No counties match “{query}”. Try another name.</p>}
    </div>
  </details>;
}
