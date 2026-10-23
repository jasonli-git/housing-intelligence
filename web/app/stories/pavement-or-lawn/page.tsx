import type { Metadata } from "next";
import Link from "next/link";

import { StoryScatter } from "@/components/StoryScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Pavement or lawn — Housing",
  description: "How much of the ground under New Jersey's homes is paved, every town from Hoboken's concrete to the Pinelands' sand, and what it does to price.",
  path: "/stories/pavement-or-lawn",
});

const PAVED = "nlcd_impervious_homes_share";
const COLS = 47, CELL = 18;
const pct = (p: number) => `${Math.round(p * 100)}%`;
const signed = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function PavementOrLawnPage() {
  const towns = (await storyTowns([PRICE, PAVED])).filter((t) => t.values[PAVED] !== undefined);
  const sorted = [...towns].sort((a, b) => b.values[PAVED]! - a.values[PAVED]!);
  const rel = relativePrices(towns);
  const points = towns.flatMap((t) => (rel.has(t.id) ? [{ id: t.id, name: t.name, x: t.values[PAVED]!, y: rel.get(t.id)!, slot: 4 }] : []));
  const W = COLS * CELL, H = Math.ceil(sorted.length / COLS) * CELL;
  const half = sorted.filter((t) => t.values[PAVED]! >= 0.5).length;
  const most = sorted[0], least = sorted.at(-1);
  // Grey for paved, green for open ground, mixed in proportion.
  // Most towns are 5–30% paved, so the scale tops out at 60%: past that, all paved-looking.
  const colour = (p: number) => `color-mix(in srgb, var(--plate-ink, var(--text-primary)) ${Math.round(Math.min(1, p / 0.6) * 100)}%, var(--story-3))`;
  return (
    <StoryShell
      title="Pavement or lawn"
      lede={<>Each square is a town, sorted from the most paved to the least, and its colour how much of the ground around its homes is roof, road and parking rather than grass, trees or sand. {most?.name} is {pct(most?.values[PAVED] ?? 0)} paved; {least?.name} {pct(least?.values[PAVED] ?? 0)}. In {half} towns, more than half the ground where people live is sealed. Below, whether the paving goes with price, against each town&rsquo;s own county.</>}
      note={<>Paving: the National Land Cover Database&rsquo;s 2021 impervious surface (MRLC, USGS), 30-metre cells averaged to about 100 metres and read at each 2020 census block&rsquo;s homes, weighted by them. Paved ground holds the day&rsquo;s heat into the night and sends rain straight to the drains. Price: Zillow&rsquo;s typical home value, each town against its own county&rsquo;s average.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key"><span><i style={{ background: colour(0.6) }} />60% paved or more</span><span><i style={{ background: colour(0.3) }} />30%</span><span><i style={{ background: colour(0) }} />Open ground</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grid of ${sorted.length} New Jersey towns sorted by the share of paved ground where their homes are, from ${most?.name} to ${least?.name}.`}>
          {sorted.map((t, i) => (
            <rect key={t.id} x={(i % COLS) * CELL} y={Math.floor(i / COLS) * CELL} width={CELL - 2} height={CELL - 2} rx={3} style={{ fill: colour(t.values[PAVED]!) }}>
              <title>{`${t.name}, ${t.countyName}: ${pct(t.values[PAVED]!)} paved`}</title>
            </rect>
          ))}
        </svg>
      </figure>
      <p className="story-note">Most paved: {sorted.slice(0, 5).map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link href={regionPath(t.id)}>{t.name}</Link> {pct(t.values[PAVED]!)}</span>)}.</p>
      <figure className="story-figure" tabIndex={0}>
        <h2 className="story-h">Paving and price</h2>
        <StoryScatter
          points={points}
          xLabel="Share of the ground paved where homes are"
          xFormat={pct}
          xTicks={[0, 0.2, 0.4, 0.6, 0.8]}
          label="Scatter plot: each town's paved share of the ground at its homes against how much dearer its homes are than its county's average."
          trendLabel={(per) => (Math.abs(per(0.1)) < 0.03 ? "Paving barely moves the price" : `${signed(per(0.1))} per 10 points of paving`)}
          named={[most?.id, least?.id].filter((x): x is number => x !== undefined)}
        />
      </figure>
    </StoryShell>
  );
}
