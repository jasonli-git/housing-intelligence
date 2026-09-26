import Link from "next/link";

import { api } from "@/lib/api";
import { byInstitution, isRestricted, shortPublisher } from "@/lib/sources";

const NOTICE_URL = "https://github.com/jasonli-git/housing-intelligence/blob/main/NOTICE";

/**
 * Site-wide attribution: every source behind any figure on the page, with its terms.
 *
 * This is a licence condition rather than a courtesy. Zillow publishes ZHVI and ZORI
 * "free for non-commercial use with attribution", and the landing page's map and ranking
 * table are Zillow figures — so before this existed, the most-visited page on the site
 * displayed Zillow data while naming no source at all.
 *
 * Rendered from `GET /sources`, which reads the same `sources` table the packet does.
 * Hard-coding the list here would have been half the work and would drift the first time
 * a source was added — and drift here is a licence problem, not a stale-copy problem.
 *
 * Grouped by institution since Milestone 18 (ARCHITECTURE #128): an institution is named
 * once and a licence its datasets share is stated once. Closed to one line since #137:
 * every institution stays named, Zillow with its Non-commercial tag, and the datasets —
 * each linked to its publisher, with how often it updates and its terms — open beneath
 * it. What satisfies attribution is the naming, and the naming never closes. Printing
 * opens the list (globals.css). The non-commercial terms themselves are the licence line
 * at the top of the page; the tag points to it.
 *
 * Absent rather than wrong when the API cannot be reached: an attribution block listing
 * sources that may not be the ones actually behind the page would be worse than none,
 * and `make check-dist` already refuses to deploy a tree built without a live API.
 */
export async function SourceFooter() {
  const sources = await api.sources();
  if (!sources?.length) return null;

  // `hip_derived` is the platform's own computed metrics, not a third party to credit.
  const external = sources.filter((s) => s.source_id !== "hip_derived");
  const institutions = byInstitution(external);

  return (
    <footer className="foot" aria-labelledby="sources-heading">
      <div className="foot-inner">
        <details className="foot-sources">
          <summary className="foot-head disclose">
            <span className="foot-title-block">
              <span className="foot-kicker">Data provenance</span>
              <h2 className="foot-label" id="sources-heading">
                Sources
              </h2>
            </span>
            <span className="foot-brief when-closed">
              {institutions.map((institution) => {
                const short = shortPublisher(institution.publisher);
                return (
                  <span className="brief-item" key={institution.publisher}>
                    {short === institution.publisher ? (
                      short
                    ) : (
                      <abbr title={institution.publisher}>{short}</abbr>
                    )}
                    {institution.sources.some(isRestricted) && (
                      <span className="nc-tag" title="See the licence line at the top of the page">
                        Non-commercial
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
            <span className="foot-intro when-open">
              Every figure on this site comes from one of these, and carries its release and
              match method in the underlying packet.
            </span>
            <span className="disclose-hint">
              <span className="when-closed">All {external.length} datasets</span>
              <span className="when-open">Hide</span>
            </span>
          </summary>

          <ul className="inst-grid" aria-label="Sources by institution">
            {institutions.map((institution) => (
              <li className="inst" key={institution.publisher}>
                <span className="inst-name">{institution.publisher}</span>
                {institution.license && <span className="inst-terms">{institution.license}</span>}
                <ul>
                  {institution.sources.map((source) => (
                    <li key={source.source_id}>
                      {/* `homepage`, not `url`: for API-fetched sources the canonical root is
                          the API itself, which returns JSON or a 404 to a reader who clicks it. */}
                      <a
                        href={source.homepage}
                        rel="noreferrer noopener"
                        target="_blank"
                        aria-label={`${source.name} (opens ${new URL(source.homepage).host} in a new tab)`}
                      >
                        {source.name}
                        <span className="out" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                      {source.cadence && <span className="ds-meta">{source.cadence}</span>}
                      {isRestricted(source) && (
                        <span className="nc-tag" title="See the licence line at the top of the page">
                          Non-commercial
                        </span>
                      )}
                      {!institution.license && <span className="ds-terms">{source.license}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>

        {/* Outside the disclosure, so the pages about the data are reachable without
            opening the source list first (Milestone 27). */}
        <p className="foot-links">
          <Link href="/freshness">How current each source is</Link>
          <Link href="/changes">What changed since it was published</Link>
        </p>

        <div className="foot-notice">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 2.5 16 5v4.4c0 3.8-2.3 6.6-6 8.1-3.7-1.5-6-4.3-6-8.1V5Z" />
            <path d="M7.2 10.1 9.1 12l3.8-4" />
          </svg>
          <div className="foot-notice-copy">
            <a
              className="foot-tab"
              href={NOTICE_URL}
              rel="noreferrer noopener"
              target="_blank"
              title="The full terms for the site's code and data, on GitHub"
            >
              Notice <span aria-hidden="true">↗</span>
            </a>
            <span className="foot-intro">
              Analysis and code are MIT licensed; the data is not ours to relicense, and this
              site cannot grant terms it was not given.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
