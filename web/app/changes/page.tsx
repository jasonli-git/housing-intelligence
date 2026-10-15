import { regionPath } from "@/lib/placeRoutes";
import type { Metadata } from "next";
import Link from "next/link";

import { BuiltAgo } from "@/components/BuiltAgo";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api, type RevisionGroup } from "@/lib/api";
import { changeLabel, otherPeriods, placeName, revisedValue, summaryLine } from "@/lib/changes";
import { dayLabel } from "@/lib/freshness";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";
import "../horizon-theme.css";
import "../data-horizon.css";

export const metadata: Metadata = pageMetadata({
  title: "What changed — Housing",
  description:
    "Figures this site had already published that a later refresh revised: how many, " +
    "which way, by how much, and the places that moved most.",
  path: "/changes",
});

/**
 * What changed (Milestone 27): the `fact_revision` rows Milestone 29 began recording,
 * shown to a reader for the first time. Summarised per refresh and metric by
 * `GET /revisions`, never row by row — one refresh alone revised 313,536 figures.
 */
export default async function ChangesPage() {
  const report = await api.revisions();
  if (!report) {
    return (
      <>
        <Masthead affordability={{ kind: "hidden" }} />
        <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history">
          <h1 className="page-title">Figures revised after they were published</h1>
          <p className="meta">
            The API is unreachable, so there is nothing to show.{" "}
            <Link href="/states/new-jersey">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  const earlier = report.total_batches - report.batches.length;

  return (
    <>
      <Masthead affordability={{ kind: "hidden" }} />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history quiet-revisions horizon-page" data-region-level="data">
        <header className="page-head" data-kind="data">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]} here="What changed" />
            <Kind kind="data" />
            <h1 className="page-title">Figures revised after they were published</h1>
            <p className="meta history-intro">
              When a publisher corrects a figure we already showed, it’s recorded here: what it was, what it is now. Newest first.
            </p>
            <nav className="history-tabs state-jump" aria-label="About the data"><Link href="/freshness"><span>Source freshness</span><i aria-hidden="true">→</i></Link><Link href="/changes" aria-current="page"><span>Revised figures</span></Link></nav>
            <ul className="data-tally" aria-label="Revision history">
              <li data-status="all"><b>{report.total_batches.toLocaleString("en-US")}</b> refreshes with revisions</li>
              {report.batches[0] && <li data-status="current"><b>{report.batches[0].figures.toLocaleString("en-US")}</b> figures revised {dayLabel(report.batches[0].revised_on)}</li>}
            </ul>
            <details className="history-explainer"><summary>About revisions and survey margins</summary><p className="meta">Publishers can revise previously published figures. Survey margins are retained for revisions recorded from 8 October 2026; earlier records kept values alone. Changes are relative to the earlier value.</p></details>
            <p className="meta fresh-built">
              {report.recorded_since
                ? `Earlier values kept since ${dayLabel(report.recorded_since)}`
                : "No earlier values kept yet"}{" "}
              · built {dayLabel(report.generated_at)}
              <BuiltAgo at={report.generated_at} /> · dates are UTC · changes are relative
              to the earlier value
            </p>
          </div>
        </header>

        {report.batches.length === 0 && (
          <p className="meta">No figure this site has published has been revised yet.</p>
        )}

        {report.batches.map((batch) => (
          <section
            key={batch.revised_on}
            className="section change-batch"
            id={`refresh-${batch.revised_on}`}
            data-jump-label={dayLabel(batch.revised_on)}
            aria-labelledby={`batch-${batch.revised_on}`}
          >
            <h2 id={`batch-${batch.revised_on}`} className="change-day">
              {dayLabel(batch.revised_on)}
              <span className="change-day-count">
                {batch.figures.toLocaleString("en-US")}{" "}
                {batch.figures === 1 ? "figure" : "figures"} revised
              </span>
            </h2>
            {batch.groups.map((group) => (
              <ChangeGroup
                key={`${group.metric_id}-${group.under_way}`}
                group={group}
                day={batch.revised_on}
              />
            ))}
          </section>
        ))}

        {earlier > 0 && (
          <p className="meta">
            {earlier} earlier {earlier === 1 ? "refresh" : "refreshes"} also revised figures; only
            the most recent {report.batches.length} are shown.
          </p>
        )}
      </main>
    </>
  );
}

function ChangeGroup({ group, day }: { group: RevisionGroup; day: string }) {
  const id = `${day}-${group.metric_id}${group.under_way ? "-under-way" : ""}`;
  return (
    <article className="change-group" aria-labelledby={id}>
      <h3 id={id} className="change-metric">
        {group.label}
      </h3>
      {group.source_id === "hip_derived" && (
        <p className="change-note">
          <span className="fresh-status">Computed by this site</span> Recomputed from the
          publishers&rsquo; figures, so it moves when they are revised.
        </p>
      )}
      {group.under_way && (
        <p className="change-note">
          <span className="fresh-status">Period still under way</span> These figures fill in as the
          period goes on; a change here is expected, not a correction.
        </p>
      )}
      {group.method_change && (
        <p className="change-note">
          <span className="fresh-status">Recomputed by this site</span> {group.method_change}
        </p>
      )}
      <p className="change-summary">{summaryLine(group)}</p>
      <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
        <table className="change-places">
          <caption className="visually-hidden">
            The places whose {group.label.toLowerCase()} moved most, one row per place
          </caption>
          <thead>
            <tr className="colheads">
              <th scope="col">Biggest changes</th>
              <th scope="col" className="change-period">
                Period
              </th>
              <th scope="col" className="num">
                Was
              </th>
              <th scope="col" className="num">
                Now
              </th>
              <th scope="col" className="num">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {group.largest.map((place) => {
              const period = periodLabel(place.period_end, group.metric_id);
              const more = otherPeriods(place, group.frequency);
              return (
                <tr key={place.region_id}>
                  <th scope="row">
                    {place.has_page ? (
                      <Link href={regionPath(place.region_id)}>{placeName(place)}</Link>
                    ) : (
                      placeName(place)
                    )}
                    {more && <span className="fresh-sub change-wide">{more}</span>}
                    {/* On a phone the period column folds in here, so was, now and the
                        change fit the screen without scrolling sideways. */}
                    <span className="fresh-sub change-narrow">
                      {more ? `${period} · ${more}` : period}
                    </span>
                  </th>
                  <td className="change-period">{period}</td>
                  <td className="num">{revisedValue(place.old_value, group, place.old_margin ?? null)}</td>
                  <td className="num">{revisedValue(place.new_value, group, place.new_margin ?? null)}</td>
                  <td className="num">{changeLabel(place)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
