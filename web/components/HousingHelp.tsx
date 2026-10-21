import { rulesFor } from "@/lib/costRules";

/** Eligibility links, never an adjustment to a published cost or household benchmark.
 * They are the place's state's programs (`rulesFor`); a state with none held shows none. */
export function HousingHelp({ state }: { state: string }) {
  const relief = rulesFor(state)?.relief ?? [];
  if (!relief.length) return null;
  return (
    <aside className="cost-relief" aria-label="Tax relief and help buying">
      <p className="cost-evidence-label">Relief and help, not subtracted</p>
      <p>
        Help depends on your age, income and circumstances. It is not deducted here:{" "}
        {relief.map((r, index) => (
          <span key={r.url}>
            <a href={r.url} target="_blank" rel="noreferrer">{r.label}</a>
            {index < relief.length - 1 ? "; " : "."}
          </span>
        ))}{" "}
        <small className="src">Links checked {relief[0].reviewed}.</small>
      </p>
    </aside>
  );
}
