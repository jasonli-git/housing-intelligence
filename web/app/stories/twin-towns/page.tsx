import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyTowns } from "@/lib/storyData";
import { logTicks, PRICE, twins } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Twin towns, different price tags — Housing",
  description: "Pairs of New Jersey towns alike in income, housing and commute whose homes are priced far apart.",
  path: "/stories/twin-towns",
});

/** What makes two towns alike here: who lives there and how, not what homes cost. */
const ALIKE = [
  { key: "acs_median_hh_income", label: "Income", show: (v: number) => formatValue(v, "usd") },
  { key: "acs_share_detached", label: "Detached", show: (v: number) => `${Math.round(v * 100)}%` },
  { key: "acs_homeownership_rate", label: "Owners", show: (v: number) => `${Math.round(v * 100)}%` },
  { key: "acs_share_built_pre_1940", label: "Pre-1940", show: (v: number) => `${Math.round(v * 100)}%` },
  { key: "acs_mean_commute_minutes", label: "Commute", show: (v: number) => `${Math.round(v)} min` },
  { key: "acs_avg_household_size", label: "Household", show: (v: number) => v.toFixed(1) },
];
const usd = (v: number) => formatValue(v, "usd");

export default async function TwinTownsPage() {
  const towns = await storyTowns([PRICE, ...ALIKE.map((a) => a.key)]);
  const pairs = twins(towns, ALIKE.map((a) => a.key), 0.25).slice(0, 12);
  const values = pairs.flatMap((p) => [p.a.values[PRICE]!, p.b.values[PRICE]!]);
  const lo = Math.log(Math.min(...values) / 1.6), hi = Math.log(Math.max(...values) * 1.6);
  const at = (v: number) => `${Math.round(((Math.log(v) - lo) / (hi - lo)) * 10000) / 100}%`;
  return (
    <StoryShell
      title="Twin towns, different price tags"
      lede={<>Each pair below is as alike as any two New Jersey towns get on the six measures in grey: what households earn, the kind of homes, how many own, how old the housing is, the commute, the household size. Yet one twin&rsquo;s homes cost up to {pairs[0]?.ratio.toFixed(1)} times the other&rsquo;s. The gap is everything those measures leave out: the schools, the train, the water, the name.</>}
      note={<>Alike: each town&rsquo;s nearest neighbour on the six measures, each scaled to its spread across all towns, kept only where the two are close; then ordered by the price gap. Measures: the Census Bureau&rsquo;s five-year American Community Survey. Price: Zillow&rsquo;s typical home value. Survey figures carry margins of error, wide in small towns.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key"><span><i style={{ background: "var(--story-up)" }} />The pricier twin</span><span><i className="starter" />The cheaper twin</span></p>
        <ul className="ladder extremes-chart twins">
          <li className="ladder-axis" aria-hidden="true">
            <span>Pair</span>
            <span className="ladder-track">{logTicks(Math.exp(lo), Math.exp(hi), 6).map((t) => <b key={t} style={{ left: at(t) }}>{usd(t)}</b>)}</span>
            <span className="num">Gap</span>
          </li>
          {pairs.map((p) => (
            <li key={`${p.a.id}-${p.b.id}`}>
              <span className="twin-traits">
                {ALIKE.map((a) => <small key={a.key}>{a.label} {a.show(p.a.values[a.key]!)} · {a.show(p.b.values[a.key]!)}</small>)}
              </span>
              <span className="ladder-track">
                <span className="visually-hidden">{`${p.a.name} ${usd(p.a.values[PRICE]!)} against ${p.b.name} ${usd(p.b.values[PRICE]!)}`}</span>
                <span className="span" style={{ left: at(p.b.values[PRICE]!), right: `calc(100% - ${at(p.a.values[PRICE]!)})` }} />
                <i className="starter" style={{ left: at(p.b.values[PRICE]!) }} />
                <i style={{ left: at(p.a.values[PRICE]!), background: "var(--story-up)" }} />
                <em className="end-name left" style={{ left: at(p.b.values[PRICE]!) }}><Link href={regionPath(p.b.id)}>{p.b.name}</Link></em>
                <em className="end-name" style={{ left: at(p.a.values[PRICE]!) }}><Link href={regionPath(p.a.id)}>{p.a.name}</Link></em>
              </span>
              <span className="num"><b>{p.ratio.toFixed(1)}×</b></span>
            </li>
          ))}
        </ul>
      </figure>
    </StoryShell>
  );
}
