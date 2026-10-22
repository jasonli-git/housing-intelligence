"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatValue } from "@/lib/format";
import { regionPath } from "@/lib/placeRoutes";
import type { LadderRow } from "@/lib/stories";

const usd = (v: number) => formatValue(v, "usd");

/**
 * Every town's three prices on one log scale: the starter home (the cheapest third), the
 * typical home, and the median of recent recorded sales. A county filter and a search keep
 * the list readable; the scale follows what is shown.
 */
export function PriceLadder({ rows, counties }: { rows: LadderRow[]; counties: string[] }) {
  const [county, setCounty] = useState("");
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => rows.filter((r) => (!county || r.countyName === county) && r.name.toLowerCase().includes(query.trim().toLowerCase())),
    [rows, county, query],
  );
  const all = shown.flatMap((r) => [r.starter, r.typical, r.sale].filter((v): v is number => v !== null));
  const lo = Math.log(Math.min(...all, 1e6) * 0.95);
  const hi = Math.log(Math.max(...all, 1e5) * 1.05);
  // Rounded, so the server's markup and the browser's match exactly.
  const share = (v: number) => Math.round(((Math.log(v) - lo) / (hi - lo)) * 10000) / 100;
  const at = (v: number) => `${share(v)}%`;
  const saleAbove = shown.filter((r) => r.sale !== null && r.sale > r.typical).length;
  return (
    <>
      <div className="ladder-controls">
        <label>County
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="">All of New Jersey</option>
            {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
        </label>
        <label>Find a town<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Town name" /></label>
        <p className="ladder-key" aria-hidden="true"><span><i className="starter" />Starter home</span><span><i className="typical" />Typical home</span><span><i className="sale" />Median sale</span></p>
      </div>
      <p className="story-note" role="status">
        {shown.length} towns · recent sales ran above the typical home value in {saleAbove} of them · scale {usd(Math.exp(lo))} to {usd(Math.exp(hi))}, spaced by ratio
      </p>
      <ul className="ladder">
        {shown.map((r) => {
          const points = [r.starter, r.typical, r.sale].filter((v): v is number => v !== null);
          return (
            <li key={r.id}>
              <span><Link href={regionPath(r.id)}>{r.name}</Link>{!county && <small> · {r.countyName}</small>}</span>
              <span className="ladder-track" role="img" aria-label={`${r.name}: starter ${r.starter ? usd(r.starter) : "not published"}, typical ${usd(r.typical)}, median sale ${r.sale ? usd(r.sale) : "not published"}`}>
                <span className="span" style={{ left: at(Math.min(...points)), right: `${Math.round((100 - share(Math.max(...points))) * 100) / 100}%` }} />
                {r.starter !== null && <i className="starter" style={{ left: at(r.starter) }} />}
                <i className="typical" style={{ left: at(r.typical) }} />
                {r.sale !== null && <i className="sale" style={{ left: at(r.sale) }} />}
              </span>
              <span className="num">{usd(r.typical)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
