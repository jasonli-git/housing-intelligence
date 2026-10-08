import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { DecisionGuide } from "@/components/DecisionGuide";
import { Masthead } from "@/components/Masthead";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { periodLabel } from "@/lib/periods";

export const metadata: Metadata = {
  title: "Buyer’s guide — Housing",
  description:
    "Can I afford to buy here, should I rent or buy, and what should I check before an offer: answered for any New Jersey place from public data.",
};

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
              Three questions answered for one place from public records: what it would cost you, whether renting costs
              less, and what to check before an offer. Every answer is worked out from published figures, never written
              by a model, and says where each figure comes from and how far it can be trusted.
            </p>
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
