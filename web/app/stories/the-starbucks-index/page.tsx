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
  { key: "tj", label: "Has a Trader Joe's", rule: "a Trader Joe's mapped in the town", metric: "osm_trader_joes_count", has: (v) => v >= 1 },
  { key: "wf", label: "Has a Whole Foods", rule: "a Whole Foods Market mapped in the town", metric: "osm_whole_foods_count", has: (v) => v >= 1 },
  { key: "sb", label: "Has a Starbucks", rule: "a Starbucks mapped in the town", metric: "osm_starbucks_count", has: (v) => v >= 1 },
  { key: "dd", label: "Has a Dunkin'", rule: "a Dunkin' mapped in the town", metric: "osm_dunkin_count", has: (v) => v >= 1 },
  { key: "wawa", label: "Has a Wawa", rule: "a Wawa mapped in the town", metric: "osm_wawa_count", has: (v) => v >= 1 },
  { key: "qc", label: "Has a QuickChek", rule: "a QuickChek mapped in the town", metric: "osm_quickchek_count", has: (v) => v >= 1 },
  { key: "diner", label: "Has a diner", rule: "a diner mapped in the town", metric: "osm_diner_count", has: (v) => v >= 1 },
  { key: "sbd", label: "More Starbucks than Dunkin'", rule: "more Starbucks than Dunkin' mapped in the town", metric: "starbucks_lead", has: (v) => v > 0 },
];

export default async function StarbucksIndexPage() {
  const raw = await storyTowns([PRICE, "osm_starbucks_count", "osm_dunkin_count", "osm_trader_joes_count", "osm_whole_foods_count", "osm_wawa_count", "osm_quickchek_count", "osm_diner_count"]);
  // Shop for shop: only towns with at least one of either chain can lean one way.
  const towns = raw.map((t) => {
    const s = t.values.osm_starbucks_count ?? 0, d = t.values.osm_dunkin_count ?? 0;
    return s + d ? { ...t, values: { ...t.values, starbucks_lead: s - d } } : t;
  });
  const premiums = traitPremiums(towns, SHOPS);
  const rel = relativePrices(towns);
  const points = towns.flatMap((t) => {
    const s = t.values.osm_starbucks_count ?? 0, d = t.values.osm_dunkin_count ?? 0;
    return s + d >= 2 && rel.has(t.id) ? [{ id: t.id, name: t.name, x: s / (s + d), y: rel.get(t.id)!, slot: s > d ? 1 : s < d ? 2 : 3, tip: `${t.name}: ${s} Starbucks, ${d} Dunkin'` }] : [];
  });
  const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
  return (
    <StoryShell
      title="The Starbucks index"
      lede="Economists have long joked that a Starbucks moving in is the surest sign a neighbourhood is gentrifying. In New Jersey the shops do sort the towns: each bubble below is a kind of shop, placed by how much dearer the towns that have one are than the other towns in their county."
      note={<>Shops: OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License; the counts are offered under the same licence. Volunteer-mapped, so a shop nobody added is missing. Prices: Zillow&rsquo;s typical home value, each town against its own county. A chain opens where it expects customers; this shows which towns those are, not that the shop raises prices.</>}
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
