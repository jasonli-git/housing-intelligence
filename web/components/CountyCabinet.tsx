"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CountyDestination } from "@/lib/countyPicker";
import { regionPath } from "@/lib/placeRoutes";

/** Pointer movement previews a folder; navigation always requires an explicit link. */
export function CountyCabinet({ counties }: { counties: CountyDestination[] }) {
  const [selected, setSelected] = useState(0);
  const [directory, setDirectory] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (!counties.length) return null;
  const county = counties[selected] ?? counties[0];
  return <div className="county-cabinet">
    <div className="cabinet-heading"><div><span className="cabinet-kicker">The county collection</span><h3>{counties.length} places to begin</h3></div>
      <button type="button" className="cabinet-view" aria-pressed={directory} aria-controls="cabinet-directory" onClick={() => setDirectory(!directory)}>{directory ? "Folder view" : "All counties"}</button>
    </div>
    <div className="cabinet-stage" hidden={directory}>
      <div className="cabinet-files" role="group" aria-label="Preview a county; arrow keys browse folders">
        {counties.map((item, index) => <button type="button" key={item.id} ref={node => { buttons.current[index] = node; }}
          className="cabinet-file" aria-pressed={county.id === item.id} aria-controls="cabinet-preview"
          onPointerEnter={event => { if (event.pointerType === "mouse") setSelected(index); }}
          onClick={() => setSelected(index)} onFocus={() => setSelected(index)}
          onKeyDown={event => {
            const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
            const next = event.key === "Home" ? 0 : event.key === "End" ? counties.length - 1 : delta ? Math.min(counties.length - 1, Math.max(0, index + delta)) : null;
            if (next !== null) { event.preventDefault(); buttons.current[next]?.focus(); buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" }); }
          }}>
          <span className="cabinet-file-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{item.name.replace(/ County$/, "")}</span><span className="cabinet-file-mark" aria-hidden="true">NJ</span>
        </button>)}
      </div>
      <div className="cabinet-preview" id="cabinet-preview">
        <div className="cabinet-drawing" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <span className="cabinet-kicker">New Jersey · County {selected + 1} of {counties.length}</span>
        <h4>{county.name}</h4>
        <p>Housing costs, the local picture and the figures behind it.</p>
        <Link className="destination-county cabinet-open" href={regionPath(county.id)}>Explore county <span aria-hidden="true">↗</span></Link>
        <small>Browse folders. Open a place that interests you.</small>
      </div>
    </div>
    <nav id="cabinet-directory" hidden={!directory} className="place-county-grid" aria-label="All counties">
      {counties.map(item => <Link className="destination-county" key={item.id} href={regionPath(item.id)}>{item.name.replace(/ County$/, "")} <small aria-hidden="true">↗</small></Link>)}
    </nav>
  </div>;
}
