import { api } from "@/lib/api";
import { byInstitution, isRestricted } from "@/lib/sources";

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
 * once and a licence its datasets share is stated once, which is where the old footer's
 * height went. Every dataset still links to its publisher and carries how often it
 * updates. Nothing collapses: quiet, but never hidden, and it prints. The
 * non-commercial terms themselves are the licence line at the top of the page; here each
 * restricted dataset carries a tag that points to it.
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

  return (
    <footer className="foot" aria-labelledby="sources-heading">
      <div className="foot-inner">
        <div className="foot-head">
          <h2 className="foot-label" id="sources-heading">
            Sources
          </h2>
          <span className="foot-intro">
            Every figure on this site comes from one of these, and carries its release and
            match method in the underlying packet.
          </span>
        </div>

        <ul className="inst-grid" aria-label="Sources by institution">
          {byInstitution(external).map((institution) => (
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

        {/* The last line mirrors the first: NOTICE leads it in the SOURCES label's style. */}
        <div className="foot-head">
          <a
            className="foot-tab"
            href={NOTICE_URL}
            rel="noreferrer noopener"
            target="_blank"
            title="The full terms for the site's code and data, on GitHub"
          >
            Notice
          </a>
          <span className="foot-intro">
            Analysis and code are MIT licensed; the data is not ours to relicense, and this
            site cannot grant terms it was not given.
          </span>
        </div>
      </div>
    </footer>
  );
}
