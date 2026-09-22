import { Definition } from "@/components/Definition";
import type { Term } from "@/lib/glossary";

const COMPUTED: Term = {
  key: "computed",
  title: "Computed from the data, not AI",
  phrases: [],
  definition:
    "The figures, rankings, costs, profiles, summaries and maps on this page are assembled " +
    "from published data by fixed rules, not written by AI. When a region includes a labelled " +
    "interpretation inside its expanded detail, that is the one part a language model wrote.",
};

/** The same provenance promise beside every place title, with its full meaning attached. */
export function ComputedBadge() {
  return (
    <span className="computed-line title-computed">
      <Definition term={COMPUTED}>
        <span className="computed">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
          Computed from the data · not AI
        </span>
      </Definition>
    </span>
  );
}
