"use client";

import { AffordExplorer } from "@/components/AffordExplorer";
import { useHousingMode } from "@/components/useHousingMode";
import type { AffordData } from "@/lib/affordData";

/** The county profile stays put; only the material below its profile ticker changes mode. */
export function CountyModeWorkspace({
  countyId,
  countyName,
  afford,
}: {
  countyId: number;
  countyName: string;
  afford: AffordData | null;
}) {
  const mode = useHousingMode();

  return (
    <div
      className={mode === "afford" ? "county-mode-controller region-afford-mode" : "county-mode-controller"}
      data-mode={mode}
    >
      {mode === "afford" && (
        <div key={mode} className="mode-panel">
          <header className="county-afford-intro">
            <p className="eyebrow">Start with your budget</p>
            <h2>What can I afford in {countyName}?</h2>
            <p>Set an income, choose owning or renting, and compare the municipalities in this county on the same map.</p>
          </header>
          {afford ? (
            <AffordExplorer
              {...afford}
              appearance="atlas"
              scope={{ countyId, countyName }}
            />
          ) : (
            <p className="meta">Affordability figures are unavailable right now.</p>
          )}
        </div>
      )}
    </div>
  );
}
