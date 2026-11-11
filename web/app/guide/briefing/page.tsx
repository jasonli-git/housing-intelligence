import type { Metadata } from "next";
import { Briefing } from "@/components/Briefing";
import { Masthead } from "@/components/Masthead";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../../tool-pages.css";
import "../../horizon-theme.css";
import "./briefing.css";

export const metadata: Metadata = pageMetadata({ title: "Buyer’s briefing — Housing", description: "A ten-slide briefing on buying in a New Jersey town.", path: "/guide/briefing" });

/** MOCK (2026-11-11): the Buyer's guide as a briefing. */
export default async function BriefingPage() {
  const [rate, catalog] = await Promise.all([nationalMortgageRate(), api.metrics()]);
  const newest = Object.fromEntries((catalog ?? []).map((m) => [m.metric_id, m.last_period]));
  return <>
    <Masthead affordability={{ kind: "route" }} guideActive title="Buyer’s briefing" />
    <main id="main-content" tabIndex={-1} className="shell horizon-page bf-page" data-kind="guide">
      {rate ? <Briefing artifactUrl={process.env.GUIDE_PREVIEW_ARTIFACT_URL ?? artifactUrl} rate={rate.value} newest={newest} /> : <p>The mortgage rate is unavailable in this build.</p>}
    </main>
  </>;
}
