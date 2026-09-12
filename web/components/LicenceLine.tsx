import { api } from "@/lib/api";
import { isRestricted, licenceLine } from "@/lib/sources";

/**
 * The non-commercial terms at the top right of every page, under the county picker.
 *
 * Out of the footer since Milestone 18 (ARCHITECTURE #128), and boxed in the footer
 * tag's Non-commercial red after the owner's review on a phone (#133): as plain text the
 * top of a small screen read as a wall of prose, and a coloured box both breaks it up
 * and says "terms" before a word is read. It names the restricted sources from
 * `GET /sources`, so a new one is covered without anyone editing this, and it is
 * deliberately not print-hidden: the terms travel with a printout.
 */
export async function LicenceLine() {
  const sources = await api.sources();
  const line = licenceLine((sources ?? []).filter(isRestricted).map((s) => s.name));
  if (!line) return null;

  return (
    <div className="licence">
      <p className="licence-box">
        <strong className="licence-label">Not for commercial use</strong>
        <span className="visually-hidden">: </span>
        <span className="licence-text">{line}</span>
      </p>
    </div>
  );
}
