import type { Metadata } from "next";
import { Briefing } from "@/components/Briefing";
import { Masthead } from "@/components/Masthead";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "./briefing.css";

export const metadata: Metadata = pageMetadata({ title: "Buyer’s guide — Housing", description: "A twelve-slide briefing on buying in any New Jersey town: the bottom line first, then cost, market, risk and daily life, with sources.", path: "/guide" });

/** The Buyer's guide as a briefing (#498): one town in, the same twelve slides out. */
export default async function GuidePage() {
  const [rate, catalog] = await Promise.all([nationalMortgageRate(), api.metrics()]);
  const newest = Object.fromEntries((catalog ?? []).map((m) => [m.metric_id, m.last_period]));
  return <>
    <Masthead affordability={{ kind: "route" }} guideActive />
    <main id="main-content" tabIndex={-1} className="shell horizon-page bf-page" data-kind="guide">
      <header className="tool-head"><h1>Buyer’s guide</h1></header>
      {rate ? <Briefing artifactUrl={process.env.GUIDE_PREVIEW_ARTIFACT_URL ?? artifactUrl} rate={rate.value} newest={newest} /> : <p>The mortgage rate is unavailable in this build.</p>}
    </main>
  </>;
}
