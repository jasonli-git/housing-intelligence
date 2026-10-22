/**
 * Publisher notices that belong beside the figures they cover rather than in the
 * site-wide footer (2026-10-19). NJDEP's agreement words its notice for "this
 * (map/publication/report)", so it sits on the exhibits drawn from NJDEP data. The text is
 * the one in `config/sources.yml`, which a test holds it to.
 */
export const NJDEP_NOTICE =
  "This (map/publication/report) was developed using New Jersey Department of Environmental Protection Geographic Information System digital data, but this secondary product has not been verified by NJDEP and is not state-authorized or endorsed.";

/**
 * The notices the footer keeps on every page; the rest are on `/sources`. HUD's terms,
 * read 2026-10-22, ask for theirs "prominently within the application" (ARCHITECTURE
 * #423); the line is the same for every HUD User source, so it shows once.
 */
export const FOOTER_NOTICE_SOURCES = ["census_acs", "fred", "hud", "zillow_zhvi"] as const;
