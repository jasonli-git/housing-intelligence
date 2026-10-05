/** Reviewed outbound links, not scraped/republished supplier report content.
 * Match by the report's printed PWSID, never by a similar place or system name.
 * Mutable supplier URLs: do not claim an automatically verified current year.
 */
const REPORTS: Record<string, { url: string; verified: string }> = {
  NJ2004002: { url: "https://amwater.com/ccr/raritan.pdf", verified: "2026-10-04" },
  NJ0408001: { url: "https://www.amwater.com/ccr/camden.pdf", verified: "2026-10-04" },
};

export function waterQualityReport(pwsid: string) {
  return Object.hasOwn(REPORTS, pwsid) ? REPORTS[pwsid] : null;
}
