import { api } from "@/lib/api";
import { isRestricted, licenceLine } from "@/lib/sources";

/**
 * The non-commercial terms at the top right of every page, under the county picker.
 *
 * Moved out of the footer's filled block at Milestone 18: a plain line, but at the top
 * of every page rather than the bottom, which makes it quieter to look at and harder to
 * miss (ARCHITECTURE #128). It names the restricted sources from `GET /sources`, so a new
 * one is covered without anyone editing this, and it is deliberately not print-hidden:
 * the terms travel with a printout.
 */
export async function LicenceLine() {
  const sources = await api.sources();
  const line = licenceLine((sources ?? []).filter(isRestricted).map((s) => s.name));
  if (!line) return null;

  return (
    <p className="licence">
      <strong>Not for commercial use:</strong> {line}
    </p>
  );
}
