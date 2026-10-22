import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { StoryPremiums } from "@/components/StoryPremiums";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { traitPremiums } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "What goes with pricier towns — Housing",
  description: "Which traits go with higher home values in New Jersey towns, compared with towns in the same county.",
  path: "/stories/pricier-towns",
});

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function PricierTownsPage() {
  const towns = await storyTowns();
  const premiums = traitPremiums(towns);
  const priced = towns.filter((t) => t.values.zhvi_sfr).length;
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/stories", label: "Visual stories" }]} here="What goes with pricier towns" />
            <Kind kind="story" />
            <h1 className="page-title">What goes with pricier towns</h1>
            <p className="story-lede">
              Each bubble is a trait some New Jersey towns share. Higher up, towns with it have pricier homes than towns
              without it in the same county; bigger, more towns have it.
            </p>
          </div>
        </header>
        <figure className="story-figure" data-story-shot>
          <StoryPremiums premiums={premiums} />
          <figcaption className="story-note">
            Premium: the gap in Zillow&rsquo;s typical home value between towns with a trait and towns without it,
            each compared only with towns in its own county, so a trait is not standing in for one county against
            another. {priced} of New Jersey&rsquo;s 564 towns have a typical home value. A trait goes with pricier
            towns; it does not make them so. Survey shares carry margins of error, shown on each town&rsquo;s page.
          </figcaption>
        </figure>
        <details className="story-details" open>
          <summary>The figures</summary>
          <table className="story-table">
            <thead><tr><th scope="col">Trait</th><th scope="col">Towns with it</th><th scope="col" className="num">Premium</th><th scope="col">Priciest towns with it</th></tr></thead>
            <tbody>
              {premiums.map((p) => (
                <tr key={p.trait.key}>
                  <th scope="row">{p.trait.label}<br /><small>{p.trait.rule}</small></th>
                  <td>{p.towns} of {p.measured}</td>
                  <td className="num">{pct(p.premium)}</td>
                  <td>{p.examples.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <p className="story-note"><Link href="/stories">More visual stories →</Link></p>
      </main>
    </>
  );
}
