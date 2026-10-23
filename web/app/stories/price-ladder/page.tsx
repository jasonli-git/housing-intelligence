import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { PriceLadder } from "@/components/PriceLadder";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { ladder } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The price ladder — Housing",
  description: "Every New Jersey town's starter home, typical home and recent sale prices on one scale.",
  path: "/stories/price-ladder",
});

export default async function PriceLadderPage() {
  const towns = await storyTowns();
  const rows = ladder(towns);
  const counties = [...new Set(rows.map((r) => r.countyName))].sort();
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/stories", label: "Visual stories" }]} here="The price ladder" />
            <Kind kind="story" />
            <h1 className="page-title">The price ladder</h1>
            <p className="story-lede">
              Three prices for every town, priciest first: what a starter home is worth, what the typical home is worth,
              and what homes actually sold for. Where the ring sits right of the dot, recent sales ran above the estimate.
            </p>
          </div>
        </header>
        <div data-story-shot><PriceLadder rows={rows} counties={counties} /></div>
        <p className="story-note">
          Starter and typical homes: Zillow&rsquo;s values for the cheapest third and the middle third of homes, houses
          and condos together. Median sale: usable one- to four-family sales over the last three years, from the
          state&rsquo;s records. They measure different things, so a gap is information, not an error.{" "}
          <Link href="/stories">More visual stories →</Link>
        </p>
      </main>
    </>
  );
}
