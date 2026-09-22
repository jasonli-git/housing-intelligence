"use client";

import { useEffect, useState } from "react";
import { AffordExplorer } from "@/components/AffordExplorer";
import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { HOUSING_MODE_EVENT } from "@/components/HousingModeToggle";
import type { AffordData } from "@/lib/affordData";
import type { Section } from "@/lib/groups";

export function StateModeWorkspace({ frame, counties, sections, initial, afford }: {
  frame: { width: number; height: number };
  counties: number;
  sections: Section<Measure>[];
  initial: string;
  afford: AffordData | null;
}) {
  const [mode, setMode] = useState<"state" | "afford">("state");
  useEffect(() => {
    const read = () => setMode(new URLSearchParams(window.location.search).get("mode") === "afford" ? "afford" : "state");
    const custom = (event: Event) => setMode((event as CustomEvent<string>).detail === "afford" ? "afford" : "state");
    read();
    window.addEventListener("popstate", read);
    window.addEventListener(HOUSING_MODE_EVENT, custom);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener(HOUSING_MODE_EVENT, custom);
    };
  }, []);

  return (
    <div className={mode === "afford" ? "nj-mode nj-afford-mode" : "nj-mode"} data-mode={mode}>
      {mode === "afford" ? afford ? (
        <>
          <header className="nj-afford-intro">
            <p className="eyebrow">Start with your budget</p>
            <h2>What does this mean for you?</h2>
            <p>Set an income, choose owning or renting, and the same map becomes a practical view of the places within reach.</p>
          </header>
          <AffordExplorer {...afford} appearance="atlas" />
        </>
      ) : <p className="meta">Affordability figures are unavailable right now.</p> : (
        <CountyExplorer frame={frame} counties={counties} sections={sections} initial={initial} />
      )}
    </div>
  );
}

