import type { Metadata } from "next";

import { StoryPremiums } from "@/components/StoryPremiums";
import { StoryScatter } from "@/components/StoryScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices, traitPremiums, type Trait } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The Starbucks index — Housing",
  description: "What the shops in a New Jersey town, from Starbucks and Dunkin' to Trader Joe's and Wawa, say about what its homes cost.",
  path: "/stories/the-starbucks-index",
});

/** A town has the trait where its count is at least one; the shop-for-shop trait is computed below. */
const SHOPS: Trait[] = [
  { key: "tj", label: "Has a Trader Joe's", rule: "a Trader Joe's listed in the town", metric: "overture_trader_joes_count", has: (v) => v >= 1 },
  { key: "wf", label: "Has a Whole Foods", rule: "a Whole Foods Market listed in the town", metric: "overture_whole_foods_count", has: (v) => v >= 1 },
  { key: "sb", label: "Has a Starbucks", rule: "a Starbucks listed in the town", metric: "overture_starbucks_count", has: (v) => v >= 1 },
  { key: "dd", label: "Has a Dunkin'", rule: "a Dunkin' listed in the town", metric: "overture_dunkin_count", has: (v) => v >= 1 },
  { key: "wawa", label: "Has a Wawa", rule: "a Wawa listed in the town", metric: "overture_wawa_count", has: (v) => v >= 1 },
  { key: "qc", label: "Has a QuickChek", rule: "a QuickChek listed in the town", metric: "overture_quickchek_count", has: (v) => v >= 1 },
  { key: "diner", label: "Has a diner", rule: "a diner listed in the town", metric: "overture_diner_count", has: (v) => v >= 1 },
  { key: "sbd", label: "More Starbucks than Dunkin'", rule: "more Starbucks than Dunkin' listed in the town", metric: "starbucks_lead", has: (v) => v > 0 },
];

export default async function StarbucksIndexPage() {
  const raw = await storyTowns([PRICE, "overture_starbucks_count", "overture_dunkin_count", "overture_trader_joes_count", "overture_whole_foods_count", "overture_wawa_count", "overture_quickchek_count", "overture_diner_count"]);
  // Shop for shop: only towns with at least one of either chain can lean one way.
  const towns = raw.map((t) => {
    const s = t.values.overture_starbucks_count ?? 0, d = t.values.overture_dunkin_count ?? 0;
    return s + d ? { ...t, values: { ...t.values, starbucks_lead: s - d } } : t;
  });
  const premiums = traitPremiums(towns, SHOPS);
  const rel = relativePrices(towns);
  const points = towns.flatMap((t) => {
    const s = t.values.overture_starbucks_count ?? 0, d = t.values.overture_dunkin_count ?? 0;
    return s + d >= 2 && rel.has(t.id) ? [{ id: t.id, name: t.name, x: s / (s + d), y: rel.get(t.id)!, slot: s > d ? 1 : s < d ? 2 : 3, tip: `${t.name}: ${s} Starbucks, ${d} Dunkin'` }] : [];
  });
  const shopName = (p: (typeof premiums)[number]) => (p.trait.label.startsWith("Has ") ? p.trait.label.slice(4) : p.trait.label[0].toLowerCase() + p.trait.label.slice(1)).replace(/'/g, "’");
  const starbucks = premiums.find((p) => p.trait.key === "sb"), dunkin = premiums.find((p) => p.trait.key === "dd");
  const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
  return (
    <StoryShell
      title="The Starbucks index"
      takeaway={<><b>Towns with {shopName(premiums[0])} run {pct(premiums[0].premium)} against the rest of their county</b>, the widest gap of any shop here.{starbucks && dunkin ? <> With a Starbucks, {pct(starbucks.premium)}; with a Dunkin&rsquo;, {pct(dunkin.premium)}.</> : null}</>}
      lede="Economists have long joked that a Starbucks moving in is the surest sign a neighbourhood is gentrifying. In New Jersey the shops do sort the towns: each bubble below is a kind of shop, placed by how much dearer the towns that have one are than the other towns in their county."
      note={<>Shops: Overture Maps Foundation, overturemaps.org, from Meta, Microsoft, Foursquare and other providers; closed places left out, a shop listed twice counted once, and a store only All the Places lists left out, so the counts are a floor (QuickChek’s furthest from complete). Prices: Zillow&rsquo;s typical home value, each town against its own county. A chain opens where it expects customers; this shows which towns those are, not that the shop raises prices.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <StoryPremiums premiums={premiums} />
      </figure>
      <h2 className="story-h">Starbucks or Dunkin&rsquo;?</h2>
      <p className="ladder-key"><span><i style={{ background: "var(--story-1)" }} />More Starbucks</span><span><i style={{ background: "var(--story-3)" }} />Even</span><span><i style={{ background: "var(--story-2)" }} />More Dunkin&rsquo;</span></p>
      <p className="story-note">Each dot is a town with at least two of the chains between them.</p>
      <figure className="story-figure" tabIndex={0}>
        <StoryScatter
          points={points}
          xLabel="Starbucks' share of the town's Starbucks and Dunkin'"
          xFormat={(v) => `${Math.round(v * 100)}%`}
          xTicks={[0, 0.25, 0.5, 0.75, 1]}
          label="Scatter plot: each town's Starbucks share of the two chains against how much dearer its homes are than its county's."
          trendLabel={(per) => `${pct(per(1))} from all Dunkin' to all Starbucks`}
        />
      </figure>
    </StoryShell>
  );
}
