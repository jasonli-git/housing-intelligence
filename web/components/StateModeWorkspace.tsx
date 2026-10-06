"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Measure } from "@/components/CountyExplorer";
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
        <p>Start with a county, or go straight to a town or ZIP.</p>
        <div className="place-discovery-search"><PlaceSearch />
          <Link className="place-budget-link" href="/afford?county=all">Search by budget <span aria-hidden="true">↗</span></Link>
        </div>
        <nav aria-label="New Jersey counties" className="place-county-grid">
          {countyPages.map(county => <Link key={county.id} href={`/regions/${county.id}`}><span>{county.name.replace(/ County$/, "")}</span><small>County <span aria-hidden="true">↗</span></small></Link>)}
        </nav>
        {!countyPages.length && <p>County pages are unavailable in this snapshot. Try the place search.</p>}
      </div>
      <CountyComparison sections={sections} initial={initial} />
    </section>
  );
}
