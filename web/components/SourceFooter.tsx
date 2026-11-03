import Link from "next/link";

import { BuiltAgo } from "@/components/BuiltAgo";
import { SiteStatus } from "@/components/SiteStatus";
import { api } from "@/lib/api";
import { dayLabel } from "@/lib/freshness";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";
import { FOOTER_NOTICE_SOURCES } from "@/lib/notices";
import { byInstitution, isRestricted, shortPublisher } from "@/lib/sources";

const NOTICE_URL = `${REPO_URL}/blob/main/NOTICE`;
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

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
 * once. One line since #137: every institution stays named, Zillow with its
 * Non-commercial tag, and what satisfies attribution is the naming, which never closes.
 * Since #459 each dataset, with its link, cadence and terms, is listed on /sources
 * rather than in a disclosure here. The non-commercial terms themselves are the licence
 * line at the top of the page; the tag points to it.
 *
 * Absent rather than wrong when the API cannot be reached: an attribution block listing
 * sources that may not be the ones actually behind the page would be worse than none,
 * and `make check-dist` already refuses to deploy a tree built without a live API.
 */
/** A notice with any address in it made a link: FRED's requires a link to its terms. */
function linked(notice: string) {
  const parts = notice.split(/(https:\/\/\S+)/);
  return parts.map((part, index) =>
    part.startsWith("https://") ? (
      <a key={index} href={part} rel="noreferrer noopener" target="_blank">
        {part.replace(/^https:\/\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

export async function SourceFooter() {
  const builtAt = process.env.SITE_BUILT_AT ?? new Date().toISOString();
  const sources = await api.sources();
  if (!sources?.length) return null;

  // `hip_derived` is the platform's own computed metrics, not a third party to credit.
  const external = sources.filter((s) => s.source_id !== "hip_derived");
  const institutions = byInstitution(external);
  // Four notices on every page (ARCHITECTURE #386, #423): Zillow's citation, which its
  // terms require on each page showing its data, and the Census, FRED and HUD User API
  // notices, which theirs ask for "prominently". FRED's own series citation and every other notice are on
  // /sources; NJDEP's also sits on the exhibits drawn from its data.
  const footerSources = new Set<string>(FOOTER_NOTICE_SOURCES);
  const notices = [
    ...new Set(
      external
        .filter((s) => footerSources.has(s.source_id))
        .flatMap((s) => (s.source_id === "fred" ? (s.notices ?? []).filter((n) => n.includes("FRED® API")) : s.notices ?? [])),
    ),
  ];

  // Three bands in one style (#460): the notices, the sources with the pages about the
  // data, and the code and data terms. No cards, so no band outranks the page above it.
  return (
    <footer className="site-foot" aria-labelledby="sources-heading">
      <div className="site-foot-inner">
        {/* Required publisher statements stay visible and verbatim, before the sources. */}
        {notices.length > 0 && (
          <div className="site-foot-band" role="group" aria-label="Notices the sources require">
            <h2 className="site-foot-label">Publisher notices</h2>
            <p className="site-foot-notices">
              {notices.map((notice) => (
                <span className="site-foot-notice" key={notice}>
                  <b>{[...new Set(external.filter((source) => source.notices?.includes(notice)).map((source) => shortPublisher(source.publisher)))].join(" · ")}</b>{" "}
                  {linked(notice)}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* The naming is the attribution (#137): every institution, Zillow with its
            Non-commercial tag, on every page. Each dataset, its link and terms are on /sources. */}
        <section className="site-foot-band" aria-labelledby="sources-heading">
          <h2 className="site-foot-label" id="sources-heading">Sources</h2>
          <p className="site-foot-sources">
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
          </p>
          <nav className="site-foot-links" aria-label="About the data">
            <Link href="/sources">Every source and its terms</Link>
            <Link href="/data">How the data is built</Link>
            <Link href="/freshness">How current each source is</Link>
            <Link href="/changes">Figures revised after publication</Link>
          </nav>
        </section>

        <section className="site-foot-band" aria-label="Code and data terms">
          <h2 className="site-foot-label">Terms</h2>
          {/* AGPL section 13: a site running this code offers its users the source. */}
          <p className="site-foot-intro">
            The code is free software under the GNU Affero General Public License v3.0, and{" "}
            <a href={REPO_URL} rel="noreferrer noopener" target="_blank">
              its source is public
            </a>
            . The data is not ours to relicense, and this site cannot grant terms it was not
            given. Questions or corrections:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <nav className="site-foot-links" aria-label="Site policies">
            <a href={NOTICE_URL} rel="noreferrer noopener" target="_blank" title="The full terms for the site's code and data, on GitHub">
              Notice <span aria-hidden="true">↗</span>
            </a>
            <Link href="/terms">Terms of use</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={LICENSE_URL} rel="noreferrer noopener" target="_blank" title="The GNU Affero General Public License v3.0, on GitHub">
              License: AGPL-3.0 <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </section>

        {/* The site's pulse: when it was built and when its sources were last checked. */}
        <p className="site-foot-meta">
          <span className="site-foot-pulse" aria-hidden="true" />
          Built <time dateTime={builtAt}>{dayLabel(builtAt)}</time>
          <BuiltAgo at={builtAt} />
          <span aria-hidden="true">·</span>
          <SiteStatus />
        </p>
      </div>
    </footer>
  );
}
