import { api } from "@/lib/api";
import { isRestricted, licenceLine } from "@/lib/sources";

/**
 * The non-commercial terms at the top of every page, under the bar.
 *
 * Out of the footer since Milestone 18 (ARCHITECTURE #128), boxed after the owner's
 * review on a phone (#133) and across the content width since (#135). Closed to its
 * label since #136: the label alone says what a reader must not miss — these figures
 * carry a restriction — and the terms naming which sources are one click away, so the
 * top of every page reads three words instead of a paragraph. Amber rather than red,
 * because this is a condition of use and red read as an error.
 *
 * A native `<details>`, so it opens with no script, from the keyboard, and for
 * find-in-page. It names the restricted sources from `GET /sources`, so a new one is
 * covered without anyone editing this, and printing opens it (globals.css): the terms
 * still travel with a printout.
 */
export async function LicenceLine() {
  const sources = await api.sources();
  const line = licenceLine((sources ?? []).filter(isRestricted).map((s) => s.name));
  if (!line) return null;

  return (
    <div className="licence">
      <details className="licence-box">
        <summary className="disclose">
          <strong className="licence-label">Not for commercial use</strong>
          <span className="disclose-hint">
            <span className="when-closed">Details</span>
            <span className="when-open">Hide</span>
          </span>
        </summary>
        <p className="licence-text">{line}</p>
      </details>
    </div>
  );
}
