import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyCounties, storyTowns, storyZips } from "@/lib/storyData";
import { extremes } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Priciest and cheapest in each county — Housing",
  description: "The most and least expensive town and ZIP code in every New Jersey county, by typical home value.",
  path: "/stories/priciest-and-cheapest",
});

const usd = (v: number) => formatValue(v, "usd");

export default async function PriciestAndCheapestPage() {
  const [towns, zips, counties] = await Promise.all([storyTowns(), storyZips(), storyCounties()]);
  const rows = extremes(towns, zips, counties);
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/stories", label: "Visual stories" }]} here="Priciest and cheapest in each county" />
            <Kind kind="story" />
            <h1 className="page-title">Priciest and cheapest in each county</h1>
            <p className="story-lede">
              Every county&rsquo;s most and least expensive town and ZIP code by typical home value, the counties with the
              widest gap first.
            </p>
          </div>
        </header>
        <ul className="extremes">
          {rows.map((e) => (
            <li key={e.county}>
              <h2><Link href={regionPath(e.county)}>{e.countyName} County</Link></h2>
              <p className="spread">The priciest town&rsquo;s typical home is {e.spread.toFixed(1)}× the cheapest&rsquo;s.</p>
              <span className="extreme-kicker">Towns</span>
              <div className="extreme-pair">
                <div><span className="up">Priciest</span><b><Link href={regionPath(e.priciest.id)}>{e.priciest.name}</Link></b><span>{usd(e.priciest.value)}</span></div>
                <div><span className="down">Cheapest</span><b><Link href={regionPath(e.cheapest.id)}>{e.cheapest.name}</Link></b><span>{usd(e.cheapest.value)}</span></div>
              </div>
              {e.zipPriciest && e.zipCheapest && (
                <>
                  <span className="extreme-kicker">ZIP codes</span>
                  <div className="extreme-pair">
                    <div><span className="up">Priciest</span><b><Link href={regionPath(e.zipPriciest.id)}>{e.zipPriciest.name}</Link></b><span>{usd(e.zipPriciest.value)}</span></div>
                    <div><span className="down">Cheapest</span><b><Link href={regionPath(e.zipCheapest.id)}>{e.zipCheapest.name}</Link></b><span>{usd(e.zipCheapest.value)}</span></div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="story-note">
          Typical home value: Zillow&rsquo;s estimate for the middle third of homes, houses and condos together, for the
          towns and ZIP codes Zillow covers. A ZIP code is a mail route, not part of a county; one that crosses a county
          line is placed in the county holding its centre. <Link href="/stories">More visual stories →</Link>
        </p>
      </main>
    </>
  );
}
