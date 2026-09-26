import type { Metadata } from "next";
import Link from "next/link";

import { BuiltAgo } from "@/components/BuiltAgo";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api, type FreshnessStatus } from "@/lib/api";
import {
  checkedDaysBefore,
  dayLabel,
  nextLabel,
  sortForDisplay,
  STALE_CHECK_DAYS,
  STATUS_COPY,
  stillUnderWay,
  throughLabel,
} from "@/lib/freshness";

export const metadata: Metadata = {
  title: "How current is each source — Housing",
  description:
    "For every public source behind this site: how recent its data is, when the site last " +
    "asked for something newer, and what is waiting to take effect.",
};

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
        <Masthead affordability={{ kind: "route" }} />
        <main className="shell">
          <h1 className="page-title">How current is each source</h1>
          <p className="meta">
            The API is unreachable, so there is nothing to show.{" "}
            <Link href="/">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  const sources = sortForDisplay(report.sources);
  const shown = new Set<FreshnessStatus>(sources.map((s) => s.status));

  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main className="shell">
        <header className="page-head" data-kind="data">
          <div>
            <Crumbs trail={[{ href: "/", label: "New Jersey" }]} here="Data freshness" />
            <Kind kind="data" />
            <h1 className="page-title">How current is each source</h1>
            <p className="meta">
              Every figure on this site comes from a public source that publishes on its own
              schedule. For each one, this page keeps three dates apart: the newest period its
              figures describe, when the site last asked for anything newer, and when the data was
              downloaded. A source asked yesterday can still describe last year.
            </p>
            <p className="meta">
              Sources are checked every week. This page is rebuilt when a figure moves or a
              source&rsquo;s status changes, so everything on it is as of its build.
            </p>
            <p className="meta fresh-built">
              Built {dayLabel(report.generated_at)}
              <BuiltAgo at={report.generated_at} /> · site version {report.site_version} ·
              dates are UTC
            </p>
          </div>
        </header>

        <section className="section" aria-labelledby="fresh-heading">
          <h2 id="fresh-heading" className="visually-hidden">
            Sources
          </h2>
          <div className="scroll-x">
            <table className="freshness">
              <caption className="visually-hidden">
                Each source: its status, the newest period its figures describe, when it was last
                checked for a newer release, when it was downloaded, and any release waiting to take
                effect
              </caption>
              <thead>
                <tr className="colheads">
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Data through</th>
                  <th scope="col">Last checked</th>
                  <th scope="col">Downloaded</th>
                  <th scope="col">Next release</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const daysOld = checkedDaysBefore(report.generated_at, source.checked_at);
                  return (
                    <tr key={source.source_id} data-status={source.status}>
                      <th scope="row">
                        <span className="fresh-name">{source.name}</span>
                        <span className="fresh-sub">
                          {source.publisher} · publishes {source.cadence}
                        </span>
                      </th>
                      <td>
                        <span className="fresh-status">{STATUS_COPY[source.status].label}</span>
                      </td>
                      <td>
                        {throughLabel(source.period_observed_end)}
                        {stillUnderWay(report.generated_at, source.period_observed_end) && (
                          <span className="fresh-sub">a period still under way</span>
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
                      <td>{nextLabel(source)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <dl className="fresh-legend">
            {(Object.keys(STATUS_COPY) as FreshnessStatus[])
              .filter((status) => shown.has(status))
              .map((status) => (
                <div key={status}>
                  <dt>{STATUS_COPY[status].label}</dt>
                  <dd>{STATUS_COPY[status].means}</dd>
                </div>
              ))}
          </dl>
        </section>
      </main>
    </>
  );
}
