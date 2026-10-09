/**
 * Who runs the site and how to reach them (ARCHITECTURE #357). One place, because the
 * terms, the privacy page, the footer and the tax lookup's removal note all print them,
 * and a contact that differs between pages is worse than none.
 */

/** The person responsible for the site, as the terms and privacy pages name them. */
export const OPERATOR = "Jason Li";

/** Questions, corrections and licence correspondence. */
export const CONTACT_EMAIL = "housing@jasonli.app";

/**
 * Privacy questions and Daniel's Law removal requests only, kept apart so a request with
 * a legal deadline is never buried under general mail (#295).
 */
export const PRIVACY_EMAIL = "privacy@jasonli.app";

/** The date the terms and privacy pages were last changed; each prints it. */
export const POLICIES_UPDATED = "2026-10-09";

export const REPO_URL = "https://github.com/jasonli-git/housing-intelligence";
export const FRED_TERMS_URL = "https://fred.stlouisfed.org/docs/api/terms_of_use.html";
