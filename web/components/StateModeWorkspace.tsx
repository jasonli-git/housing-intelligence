"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Measure } from "@/lib/measures";
import { SectionJump } from "@/components/SectionJump";
import { CountyComparison } from "@/components/CountyComparison";
import { PlaceSearch } from "@/components/PlaceSearch";
import type { CountyDestination } from "@/lib/countyPicker";
import type { Section } from "@/lib/groups";

export function StateModeWorkspace({ countyPages, sections, initial }: {
  countyPages: CountyDestination[];
  sections: Section<Measure>[];
  initial: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"explore" | "compare">("explore");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "afford") return;
    params.delete("mode");
    router.replace(`/afford?${params}`);
  }, [router]);

  return (
    <section className="state-workspace place-first-workspace" aria-labelledby="state-workspace-heading">
      <header className="state-workspace-head">
        <div><h2 id="state-workspace-heading">Find your place</h2>
        </div>
        <SectionJump />
      </header>
      <div className="place-discovery">
        <div className="state-discovery-modes" role="group" aria-label="Find your place mode">
          <button type="button" aria-pressed={mode === "explore"} aria-controls="state-explore-panel" onClick={() => setMode("explore")}>Explore places</button>
          <button type="button" aria-pressed={mode === "compare"} aria-controls="state-compare-panel" onClick={() => setMode("compare")}>Compare counties</button>
        </div>
        <div id="state-explore-panel" hidden={mode !== "explore"}>
        <p className="place-search-label">Search a town, county or ZIP.</p>
        <div className="place-discovery-search"><PlaceSearch />
          <Link className="place-budget-link" href="/afford?county=all"><span>Find your fit <span aria-hidden="true">↗</span></span><small>Across New Jersey</small></Link>
        </div>
        <h3 id="county-directory-heading" className="county-directory-heading">Explore {countyPages.length} counties</h3>
        <nav aria-labelledby="county-directory-heading" className="place-county-grid">
          {countyPages.map(county => <Link key={county.id} href={`/regions/${county.id}`} aria-label={`Explore ${county.name}`}><span>{county.name.replace(/ County$/, "")}</span><small aria-hidden="true">↗</small></Link>)}
        </nav>
        {!countyPages.length && <p>County pages are unavailable in this snapshot. Try the place search.</p>}
        </div>
        <div id="state-compare-panel" hidden={mode !== "compare"}>
          <p className="place-search-label">Compare county figures and how they changed.</p>
          <CountyComparison sections={sections} initial={initial} embedded />
        </div>
      </div>
    </section>
  );
}
