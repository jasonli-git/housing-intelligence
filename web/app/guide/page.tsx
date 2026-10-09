import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { DecisionGuide } from "@/components/DecisionGuide";
import { Masthead } from "@/components/Masthead";
import { SectionJump } from "@/components/SectionJump";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Buyer’s guide — Housing",
  description:
    "Can I afford to buy here, should I rent or buy, and what should I check before an offer: answered for any New Jersey place from public data.",
  path: "/guide",
});

/**
 * The decision guides (Milestone 49, ARCHITECTURE #330). One page: the national rate and
 * each metric's newest period ride in it, and the place's own figures are fetched from
 * object storage when a reader picks it.
 */
export default async function GuidePage() {
  const [rate, catalog] = await Promise.all([nationalMortgageRate(), api.metrics()]);
  const newest = Object.fromEntries((catalog ?? []).map((m) => [m.metric_id, m.last_period]));

  return (
    <>
      <Masthead affordability={{ kind: "route" }} guideActive />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool guide-page">
        <header className="page-head" data-kind="tool">
          <div>
            <Crumbs
              trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]}
              here="Buyer’s guide"
            />
            <Kind kind="tool" />
            <h1 className="page-title">Before you buy.</h1>
            <p className="meta">
              What you can afford, rent versus buy, and what to check before an offer.
            </p>
            <details className="guide-about"><summary>How this guide works</summary><p className="meta">Choose a place and add your numbers. Answers are calculated from published figures, not written by a model. Each shows its sources and limits.</p></details>
            <nav className="page-section-nav" aria-label="Page sections"><SectionJump /></nav>
          </div>
        </header>
        {rate ? (
          <DecisionGuide
            artifactUrl={artifactUrl}
            rate={{ value: rate.value, asOf: periodLabel(rate.period_start, rate.metric_id) }}
            newest={newest}
          />
        ) : (
          <p className="meta">The mortgage rate could not be read when this page was built, so the guide is unavailable.</p>
        )}
      </main>
    </>
  );
}
