"use client";

import { AffordExplorer } from "@/components/AffordExplorer";
import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { pushHousingMode, useHousingMode } from "@/components/useHousingMode";
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
    <section className={mode === "afford" ? "nj-mode nj-afford-mode state-workspace" : "nj-mode state-workspace"} data-mode={mode} aria-labelledby="state-workspace-heading">
      <header className="state-workspace-head">
        <div><h2 id="state-workspace-heading">Find your part of New Jersey</h2>
          <p>{mode === "state" ? `Compare ${counties} counties on housing prices, rents and change.` : "Set your income and compare places against your budget. Estimates, not loan approvals."}</p>
        </div>
        <div className="state-workspace-choice" role="group" aria-label="County exploration view">
          <button type="button" aria-pressed={mode === "state"} onClick={() => pushHousingMode("state")}>Compare counties</button>
          <button type="button" aria-pressed={mode === "afford"} onClick={() => pushHousingMode("afford")}>Use my budget</button>
        </div>
      </header>
      <div key={mode} className="mode-panel">
        {mode === "afford" ? afford ? (
          <>
            <AffordExplorer {...afford} appearance="atlas" />
          </>
        ) : <p className="meta">Affordability figures are unavailable right now.</p> : (
          <CountyExplorer frame={frame} counties={counties} sections={sections} initial={initial} />
        )}
      </div>
    </section>
  );
}
