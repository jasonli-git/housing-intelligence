/**
 * Each county's own property-record lookup (Milestone 38), as a second source beside the
 * state's file. Checked by hand on 2026-10-02: every county links one from its board of
 * taxation's page. Nineteen use the county boards' shared search, which takes the state's
 * district code and opens on the town; Camden and Ocean run their own, which open on the
 * county. A county with no working lookup would be left out rather than linked dead.
 */

const SHARED = "https://taxrecords-nj.com/pub/cgi/prc6.cgi";

const OWN: Record<string, string> = {
  Camden: "https://www.taxdatahub.com/60d088c3d3501df3b0e45ddb/camden-county",
  Ocean: "https://tax.co.ocean.nj.us/frmtaxboardtaxlistsearch",
};

/** The county's lookup, opened on the town where it can be. */
export function countyLookup(county: string, districtCode: string): string | null {
  if (OWN[county]) return OWN[county];
  if (!/^\d{4}$/.test(districtCode)) return null;
  const countyCode = districtCode.slice(0, 2);
  return `${SHARED}?district=${districtCode}&ms_user=ctb${countyCode}`;
}
