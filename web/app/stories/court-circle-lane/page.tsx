import type { Metadata } from "next";
import Link from "next/link";

import { fittedChange, StoryScatter } from "@/components/StoryScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Court, Circle, Lane — Housing",
  description: "What New Jersey towns' street names say about when they were built, and what their homes cost.",
  path: "/stories/court-circle-lane",
});

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
const share = (v: number) => `${Math.round(v * 100)}%`;

export default async function CourtCircleLanePage() {
  const towns = await storyTowns([PRICE, "streets_court_circle_share", "streets_street_avenue_share", "acs_median_year_built"]);
  const rel = relativePrices(towns);
  const named = towns.filter((t) => t.values.streets_court_circle_share !== undefined);
  const points = named.flatMap((t) => (rel.has(t.id) ? [{ id: t.id, name: t.name, x: t.values.streets_court_circle_share!, y: rel.get(t.id)!, slot: 1 }] : []));
  // Towns in fifths by their share of Court-style names, and the median year their
  // homes were built: the street names as a clock.
  const ordered = named.filter((t) => t.values.acs_median_year_built).sort((a, b) => a.values.streets_court_circle_share! - b.values.streets_court_circle_share!);
  const fifths = Array.from({ length: 5 }, (_, i) => {
    const slice = ordered.slice(Math.floor((i * ordered.length) / 5), Math.floor(((i + 1) * ordered.length) / 5));
    const years = slice.map((t) => t.values.acs_median_year_built!).sort((a, b) => a - b);
    return { i, from: slice[0]?.values.streets_court_circle_share ?? 0, to: slice.at(-1)?.values.streets_court_circle_share ?? 0, year: years[Math.floor(years.length / 2)] ?? 0, towns: slice.length };
  });
  const [y0, y1] = [Math.min(...fifths.map((f) => f.year)) - 10, Math.max(...fifths.map((f) => f.year)) + 5];
  const mostCourt = [...named].sort((a, b) => b.values.streets_court_circle_share! - a.values.streets_court_circle_share!).slice(0, 8);
  const mostGrid = [...named].sort((a, b) => b.values.streets_street_avenue_share! - a.values.streets_street_avenue_share!).slice(0, 8);
  return (
    <StoryShell
      title="Court, Circle, Lane"
      lede={<>Street names are a clock. The old grid called its streets Street and Avenue; the post-war subdivision, built for cars and dead ends, chose Court, Circle, Lane, Way, Place and Terrace. Sort New Jersey&rsquo;s towns by how many of their streets have the newer names and the year their homes were built moves from {fifths[0].year} to {fifths[4].year}.</>}
      note={<>Street names: the Census Bureau&rsquo;s TIGER road files, the distinct names of each town&rsquo;s local roads; towns with fewer than ten are left out. Year built: the Census Bureau&rsquo;s median year built, five-year American Community Survey. Prices: Zillow&rsquo;s typical home value, each town against its own county.</>}
    >
      <figure className="story-figure">
        <h2 className="story-h">The more Courts, the newer the town</h2>
        <ul className="count-bars clock">
          {fifths.map((f) => (
            <li key={f.i}>
              <span>{f.i === 0 ? "Fewest Courts" : f.i === 4 ? "Most Courts" : `Next fifth`}<small> {share(f.from)}–{share(f.to)} of names</small></span>
              <span className="bar-line"><i style={{ width: `${Math.round(((f.year - y0) / (y1 - y0)) * 1000) / 10}%`, background: "var(--story-1)" }} />median home built {f.year}</span>
              <small>{f.towns} towns</small>
            </li>
          ))}
        </ul>
      </figure>
      <figure className="story-figure">
        <h2 className="story-h">{Math.abs(fittedChange(points, 0.1)) < 0.05 ? "And the price? Hardly related" : `And the price: ${pct(fittedChange(points, 0.1))} per 10 points of Courts`}</h2>
        <StoryScatter
          points={points}
          xLabel="Share of street names ending Court, Circle, Lane, Way, Place or Terrace"
          xFormat={share}
          xTicks={[0, 0.2, 0.4, 0.6, 0.8]}
          label="Scatter plot: each town's share of Court-style street names against how much dearer its homes are than its county's."
          trendLabel={(per) => `${pct(per(0.1))} per 10 points of Courts`}
          named={[...mostCourt.slice(0, 2), ...mostGrid.slice(0, 2)].map((t) => t.id)}
        />
      </figure>
      <div className="story-two">
        <div>
          <h2 className="story-h">Most Courts and Circles</h2>
          <ul className="count-bars">{mostCourt.map((t) => <li key={t.id}><span><Link href={regionPath(t.id)}>{t.name}</Link></span><span className="bar-line"><i style={{ width: share(t.values.streets_court_circle_share!), background: "var(--story-1)" }} />{share(t.values.streets_court_circle_share!)}</span></li>)}</ul>
        </div>
        <div>
          <h2 className="story-h">Most Streets and Avenues</h2>
          <ul className="count-bars">{mostGrid.map((t) => <li key={t.id}><span><Link href={regionPath(t.id)}>{t.name}</Link></span><span className="bar-line"><i style={{ width: share(t.values.streets_street_avenue_share!), background: "var(--story-2)" }} />{share(t.values.streets_street_avenue_share!)}</span></li>)}</ul>
        </div>
      </div>
    </StoryShell>
  );
}
