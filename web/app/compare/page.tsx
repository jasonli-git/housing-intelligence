import type { Metadata } from "next";

import { ComparePlaces } from "@/components/ComparePlaces";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { artifactUrl, nationalMortgageRate } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { periodLabel } from "@/lib/periods";
import "../tool-pages.css";
import "./compare.css";

export const metadata: Metadata = pageMetadata({
  title: "Compare places — Housing",
  description: "Up to four counties, towns or ZIP codes side by side: what homes cost, who can afford them, how they sell, and the risks.",
  path: "/compare",
});

/**
 * Places side by side (TODO "A compare page shared by its link"): one page, its choice
 * in the address, each place's figures read from its published packet in the browser.
 */
export default async function ComparePage() {
  const rate = await nationalMortgageRate();
  return (
    <>
      <Masthead affordability={{ kind: "route" }} compareActive />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool compare-page compare-ledger" data-region-level="compare">
        <header className="tool-head"><h1>Compare places</h1></header>
        {rate ? (
          <ComparePlaces
            artifactUrl={process.env.GUIDE_PREVIEW_ARTIFACT_URL ?? artifactUrl}
            rate={{ value: rate.value, asOf: periodLabel(rate.period_start, rate.metric_id) }}
          />
        ) : (
          <p className="meta">The mortgage rate could not be read when this page was built, so the comparison is unavailable.</p>
        )}
      </main>
    </>
  );
}
