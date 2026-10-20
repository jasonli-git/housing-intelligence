import { Term } from "@/components/Term";
import type { Metadata } from "next";
import Link from "next/link";

import { BuiltAgo } from "@/components/BuiltAgo";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { NextRelease } from "@/components/NextRelease";
import { StatusFilter } from "@/components/StatusFilter";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../horizon-theme.css";
import "../data-horizon.css";
import {
  checkedDaysBefore,
  dayLabel,
  groupByCadence,
  STALE_CHECK_DAYS,
  STATUS_COPY,
  stillUnderWay,
  throughLabel,
} from "@/lib/freshness";

export const metadata: Metadata = pageMetadata({
  title: "How current is each source — Housing",
  description:
    "For every public source behind this site: how recent its data is, when the site last " +
    "asked for something newer, and what is waiting to take effect.",
  path: "/freshness",
});

/**
 * The public freshness page (Milestone 27): every source's newest period, when it was
 * last asked for something newer, when it was downloaded, and what the publisher has
 * already released but not yet put in force — three dates kept apart, because a source
 * checked yesterday can still describe last year.
 *
 * Built from `GET /freshness` at publish time like every other page, so what it says is
 * true as of `generated_at`, and the page says when that was.
 */
export default async function FreshnessPage() {
  const report = await api.freshness();
  if (!report) {
    return (
      <>
        <Masthead affordability={{ kind: "hidden" }} />
        <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history">
          <h1 className="page-title">How current is each source</h1>
          <p className="meta">
            The API is unreachable, so there is nothing to show.{" "}
            <Link href="/states/new-jersey">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  const groups = groupByCadence(report.sources);

  return (
    <>
      <Masthead affordability={{ kind: "hidden" }} />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history horizon-page" data-region-level="data">
        <header className="page-head" data-kind="data">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]} here="Data freshness" />
            <Kind kind="data" />
            <h1 className="page-title">How current is each source</h1>
            <p className="meta history-intro">Every source behind the site: how recent its data is, and when we last checked for newer.</p>
            <nav className="history-tabs state-jump" aria-label="About the data"><Link href="/freshness" aria-current="page"><span>Source freshness</span></Link><Link href="/changes"><span>Revised figures</span><i aria-hidden="true">→</i></Link></nav>
            <StatusFilter
              total={report.sources.length}
              counts={(["current", "pending", "unreachable", "not_tracked"] as const)
                .map((status) => ({ status, label: STATUS_COPY[status].label.toLowerCase(), count: report.sources.filter((source) => source.status === status).length }))
                .filter((entry) => entry.count > 0)}
            />
            <details className="history-explainer"><summary>How to read these dates</summary><p className="meta">
              “Covers up to” is the latest period a source describes; “We last checked” is when
              we asked the publisher for anything newer. Publishers update at the frequencies
              below, and we check every Friday. “Next release” is the publisher’s own calendar,
              linked where it publishes one.
            </p></details>
            <p className="meta fresh-built">
              Built {dayLabel(report.generated_at)}
              <BuiltAgo at={report.generated_at} /> · site version {report.site_version} ·
              dates are UTC
            </p>
          </div>
        </header>

        <section className="section" aria-labelledby="fresh-heading">
          <h2 id="fresh-heading">By publication frequency</h2>
          {groups.map((group, index) => (
            <section
              key={group.cadence}
              className="fresh-cadence-group"
              id={`cadence-${index}`}
              data-jump-label={group.label}
              aria-labelledby={`fresh-group-${index}`}
            >
              <h3 id={`fresh-group-${index}`} className="fresh-cadence-heading">
                {group.label}
                <span>
                  {group.sources.length} {group.sources.length === 1 ? "source" : "sources"}
                </span>
              </h3>
              <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
                <table className="freshness">
                  <caption className="visually-hidden">
                    {group.label} sources: status, latest data period, last check, download, and
                    next release
                  </caption>
                  <thead>
                    <tr className="colheads">
                      <th scope="col">Source</th>
                      <th scope="col">Status</th>
                      <th scope="col">Covers up to</th>
                      <th scope="col">We last checked</th>
                      <th scope="col">We downloaded</th>
                      <th scope="col">Next release</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sources.map((source) => {
                      const daysOld = checkedDaysBefore(report.generated_at, source.checked_at);
                      const stateSource = source.source_id.startsWith("nj_");
                      return (
                        <tr
                          key={source.source_id}
                          data-status={source.status}
                          data-state-source={stateSource ? "true" : undefined}
                        >
                          <th scope="row">
                            <span className="fresh-name">
                              {source.name}
                              {stateSource && <span className="fresh-state-tag">NJ source</span>}
                            </span>
                            <span className="fresh-sub">{source.publisher}</span>
                          </th>
                          <td>
                            <span className="fresh-status">
                              <Term id={`fresh-${source.status}`} definition={STATUS_COPY[source.status].means} why={null}>{STATUS_COPY[source.status].label}</Term>
                            </span>
                          </td>
                          <td>
                            {source.in_force_from ? (
                              // HUD's income limits: a year set in advance, in force from
                              // HUD's own date rather than "through December" (#350).
                              <>FY{source.period_observed_end?.slice(0, 4)} limits<span className="fresh-sub">in force since {dayLabel(source.in_force_from)}</span></>
                            ) : (
                              <>
                                {throughLabel(source.period_observed_end)}
                                {stillUnderWay(report.generated_at, source.period_observed_end) && (
                                  <span className="fresh-sub">a period still under way</span>
                                )}
                              </>
                            )}
                            {source.published && (
                              <span className="fresh-sub">released {dayLabel(source.published)}</span>
                            )}
                          </td>
                          <td>
                            {dayLabel(source.checked_at)}
                            {daysOld !== null && daysOld > STALE_CHECK_DAYS && (
                              <span className="fresh-sub fresh-stale">
                                {daysOld} days before this page was built
                              </span>
                            )}
                          </td>
                          <td>{dayLabel(source.acquired_at)}</td>
                          <td>
                            <NextRelease source={source} builtAt={report.generated_at} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </section>
      </main>
    </>
  );
}
