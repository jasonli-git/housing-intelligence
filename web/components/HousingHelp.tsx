import { RELIEF } from "@/lib/costRules";

/** Eligibility links, never an adjustment to a published cost or household benchmark. */
export function HousingHelp() {
  return (
    <aside className="cost-relief" aria-label="Tax relief and help buying">
      <p className="cost-evidence-label">Relief and help, not subtracted</p>
      <p>
        Help depends on your age, income and circumstances. It is not deducted here:{" "}
        {RELIEF.map((r, index) => (
          <span key={r.url}>
            <a href={r.url} target="_blank" rel="noreferrer">{r.label}</a>
            {index < RELIEF.length - 1 ? "; " : "."}
          </span>
        ))}{" "}
        <small className="src">Links checked {RELIEF[0].reviewed}.</small>
      </p>
    </aside>
  );
}
