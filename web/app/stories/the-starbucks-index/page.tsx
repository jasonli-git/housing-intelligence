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

/**
 * A town has the trait where its count is at least one; the upscale grocer is computed below.
 * The list was widened beyond chains to other kinds of place on 2026-11-03.
 */
const SHOPS: Trait[] = [
  { key: "grocer", label: "Has an upscale grocer", rule: "a Whole Foods Market, Trader Joe's, Kings or Wegmans listed in the town", metric: "upscale_grocer", has: (v) => v >= 1 },
  { key: "tennis", label: "Has tennis courts", rule: "tennis courts or a tennis club listed in the town, public or private", metric: "overture_tennis_count", has: (v) => v >= 1 },
  { key: "yoga", label: "Has a yoga studio", rule: "a yoga studio listed in the town", metric: "overture_yoga_count", has: (v) => v >= 1 },
  { key: "playa", label: "Has a Playa Bowls", rule: "a Playa Bowls listed in the town", metric: "overture_playa_bowls_count", has: (v) => v >= 1 },
  { key: "golf", label: "Has a golf course", rule: "a golf course listed in the town", metric: "overture_golf_count", has: (v) => v >= 1 },
  { key: "sb", label: "Has a Starbucks", rule: "a Starbucks listed in the town", metric: "overture_starbucks_count", has: (v) => v >= 1 },
  { key: "wawa", label: "Has a Wawa", rule: "a Wawa listed in the town", metric: "overture_wawa_count", has: (v) => v >= 1 },
  { key: "dd", label: "Has a Dunkin'", rule: "a Dunkin' listed in the town", metric: "overture_dunkin_count", has: (v) => v >= 1 },
  { key: "qc", label: "Has a QuickChek", rule: "a QuickChek listed in the town", metric: "overture_quickchek_count", has: (v) => v >= 1 },
  { key: "pawn", label: "Has a pawn shop", rule: "a pawn or gold-buying shop listed in the town", metric: "overture_pawn_count", has: (v) => v >= 1 },
  { key: "mcd", label: "Has a McDonald's", rule: "a McDonald's listed in the town", metric: "overture_mcdonalds_count", has: (v) => v >= 1 },
  { key: "laundromat", label: "Has a laundromat", rule: "a laundromat listed in the town", metric: "overture_laundromat_count", has: (v) => v >= 1 },
  { key: "dollar", label: "Has a dollar store", rule: "a Dollar General, Dollar Tree or Family Dollar listed in the town", metric: "overture_dollar_store_count", has: (v) => v >= 1 },
];
const GROCERS = ["overture_whole_foods_count", "overture_trader_joes_count", "overture_kings_count", "overture_wegmans_count"];
/** A group under 25 towns swings too far by chance; one most towns share mostly says a town is big. */
const GROUPS = { minTowns: 25, maxShare: 2 / 3 };

export default async function StarbucksIndexPage() {
  const counted = SHOPS.map((s) => s.metric).filter((m) => m.startsWith("overture_"));
  const raw = await storyTowns([PRICE, ...counted, ...GROCERS]);
  const towns = raw.map((t) => {
    const grocers = GROCERS.map((m) => t.values[m]);
    return grocers.some((v) => v !== undefined) ? { ...t, values: { ...t.values, upscale_grocer: grocers.reduce<number>((a, v) => a + (v ?? 0), 0) } } : t;
  });
  const premiums = traitPremiums(towns, SHOPS, GROUPS);
  const rel = relativePrices(towns);
  const points = towns.flatMap((t) => {
    const s = t.values.overture_starbucks_count ?? 0, d = t.values.overture_dunkin_count ?? 0;
    return s + d >= 2 && rel.has(t.id) ? [{ id: t.id, name: t.name, x: s / (s + d), y: rel.get(t.id)!, slot: s > d ? 1 : s < d ? 2 : 3, tip: `${t.name}: ${s} Starbucks, ${d} Dunkin'` }] : [];
  });
  const shopName = (p: (typeof premiums)[number]) => (p.trait.label.startsWith("Has ") ? p.trait.label.slice(4) : p.trait.label[0].toLowerCase() + p.trait.label.slice(1)).replace(/'/g, "’");
  const starbucks = premiums.find((p) => p.trait.key === "sb"), dunkin = premiums.find((p) => p.trait.key === "dd");
  const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
  const highest = premiums[0], lowest = premiums[premiums.length - 1];
  const diff = (p: number) => `${Math.abs(Math.round(p * 100))}% ${p >= 0 ? "more" : "less"}`;
  const sits = (p: number) => (Math.round(p * 100) === 0 ? "sit right at the average" : `run ${diff(p)}`);
  return (
    <StoryShell
      title="The Starbucks index"
      takeaway={<><b>Homes cost {diff(highest.premium)} in towns with {shopName(highest)}, and {diff(lowest.premium)} in towns with {shopName(lowest)},</b> than elsewhere in their county.{starbucks && dunkin ? <> Starbucks towns {sits(starbucks.premium)}; Dunkin&rsquo; towns {sits(dunkin.premium)}.</> : null}</>}
      lede="Economists have long joked that a Starbucks moving in is the surest sign a neighbourhood is gentrifying. In New Jersey the shops do sort the towns: each bubble below is a chain or a kind of place, placed by how much dearer the towns that have one are than the other towns in their county."
      note={<>Shops: Overture Maps Foundation, overturemaps.org, from Meta, Microsoft, Foursquare and other providers; closed places left out, a shop listed twice counted once, and a store only All the Places lists left out, so the counts are a floor (QuickChek’s furthest from complete). A chain is matched on its brand, other places on the kind Overture files them under, so a public park’s tennis courts count. A bubble needs at least 25 towns with it and no more than two in three: fewer swing too far by chance, and a place nearly every town has mostly says the town is big. Prices: Zillow&rsquo;s typical home value, each town against its own county. A chain opens where it expects customers; this shows which towns those are, not that the shop raises prices.</>}
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
