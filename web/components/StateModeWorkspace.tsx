"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { SectionJump } from "@/components/SectionJump";
import { CountyPicker } from "@/components/CountyPicker";
import type { CountyDestination } from "@/lib/countyPicker";
import type { Section } from "@/lib/groups";

export function StateModeWorkspace({ frame, counties, countyPages, sections, initial }: {
  frame: { width: number; height: number };
  counties: number;
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
    <section className="state-workspace" aria-labelledby="state-workspace-heading">
      <header className="state-workspace-head">
        <div><h2 id="state-workspace-heading">Find your county</h2>
        </div>
        <div className="state-workspace-choice" role="group" aria-label="County exploration view">
          <Link className="state-budget-entry" href="/afford?county=all">Find places within my budget <span aria-hidden="true">↗</span></Link>
        </div>
        <SectionJump />
      </header>
      <CountyPicker counties={countyPages} />
      <div>
          <CountyExplorer frame={frame} counties={counties} sections={sections} initial={initial} />
      </div>
    </section>
  );
}
