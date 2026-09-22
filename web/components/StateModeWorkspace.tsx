"use client";

import { AffordExplorer } from "@/components/AffordExplorer";
import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { useHousingMode } from "@/components/useHousingMode";
import type { AffordData } from "@/lib/affordData";
import type { Section } from "@/lib/groups";

export function StateModeWorkspace({ frame, counties, sections, initial, afford }: {
  frame: { width: number; height: number };
  counties: number;
  sections: Section<Measure>[];
  initial: string;
  afford: AffordData | null;
}) {
  const mode = useHousingMode();

  return (
    <div className={mode === "afford" ? "nj-mode nj-afford-mode" : "nj-mode"} data-mode={mode}>
      <div key={mode} className="mode-panel">
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
    </div>
  );
}
