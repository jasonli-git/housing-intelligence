import { Term } from "@/components/Term";

/** The same provenance promise beside every place title, with its full meaning attached. */
export function ComputedBadge() {
  return (
    <span className="computed-line title-computed">
      <Term id="computed">
        <span className="computed">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
          Computed from the data · not AI
        </span>
      </Term>
    </span>
  );
}
