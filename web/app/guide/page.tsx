import type { Metadata } from "next";
import { BriefingSearch } from "@/components/BriefingSearch";
import { Masthead } from "@/components/Masthead";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "./briefing.css";

export const metadata: Metadata = pageMetadata({ title: "Briefing — Housing", description: "A seven-slide briefing on any New Jersey town: where it stands out first, then prices, taxes, flood risk and its homes, with sources.", path: "/guide" });

/**
 * The briefing's own entry (#498, #511): a search. Every New Jersey town's address is its
 * briefing since Milestone 62 (ARCHITECTURE #520), so picking a town opens that address.
 */
export default function GuidePage() {
  return <>
    <Masthead affordability={{ kind: "route" }} guideActive />
    <main id="main-content" tabIndex={-1} className="shell horizon-page bf-page" data-kind="guide">
      <header className="tool-head"><h1>Briefing</h1></header>
      <section className="bf-start">
        <h2>Get briefed on a town</h2>
        <p>Seven slides, the same for every New Jersey town: where it stands out first, then prices, taxes, flood risk and its homes.</p>
        <BriefingSearch />
      </section>
    </main>
  </>;
}
