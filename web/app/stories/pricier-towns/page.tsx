import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
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
  // Diverging bars, priciest trait first, rather than the Starbucks index's bubbles: the two
  // stories looked alike side by side (2026-11-06), and a ranked list reads at a glance here.
  const ranked = [...premiums].sort((a, b) => b.premium - a.premium);
  const reach = Math.max(...ranked.map((p) => Math.abs(p.premium)));
  const w = (p: number) => `${Math.round((Math.abs(p) / reach) * 5000) / 100}%`;
  const top = ranked[0], bottom = ranked[ranked.length - 1];
  const pricier = ranked.filter((p) => p.premium > 0).length;
  return (
    <StoryShell
      title="What goes with pricier towns"
      lede={<>Each bar is a trait some New Jersey towns share: how much pricier, or cheaper, homes are in towns with it
        than in towns without it in the same county.</>}
      takeaway={top && bottom ? <><b>{top.trait.label}: homes {Math.round(top.premium * 100)}% pricier</b> than in towns
        without it in the same county. At the other end, {bottom.trait.label.toLowerCase()}: {Math.round(-bottom.premium * 100)}% cheaper.
        {" "}{pricier} of {ranked.length} traits go with pricier homes.</> : undefined}
      note={<>Premium: the gap in Zillow&rsquo;s typical home value between towns with a trait and towns without it,
        each compared only with towns in its own county, so a trait is not standing in for one county against
        another. {priced} of New Jersey&rsquo;s 564 towns have a typical home value. A trait goes with pricier
        towns; it does not make them so. Survey shares carry margins of error, shown on each town&rsquo;s page.</>}
    >
        <ul className="diverging" aria-label="Diverging bars: each town trait by how much pricier or cheaper towns with it are than towns without it in the same county. The figures are in the table below.">
          <li className="ladder-axis" aria-hidden="true"><span>Trait</span><span className="track"><span>&larr; cheaper than the county</span><span>pricier &rarr;</span></span><span className="num">Premium</span></li>
          {ranked.map((p) => (
            <li key={p.trait.key}>
              <span><b>{p.trait.label}</b><small>{p.towns} towns</small></span>
              <span className="track" title={p.examples.join(", ")}>
                <i className={p.premium >= 0 ? "up" : "down"} style={{ width: w(p.premium) }} />
              </span>
              <span className="num">{pct(p.premium)}</span>
            </li>
          ))}
        </ul>
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
    </StoryShell>
  );
}
