import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyTowns } from "@/lib/storyData";
import { PRICE, wordPremiums } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "What’s in a name? — Housing",
  description: "Whether words in New Jersey town names, from Lake and Beach to Park and Brook, go with pricier or cheaper homes.",
  path: "/stories/whats-in-a-name",
});

/** Words to try: landscape, water, direction and the like. Only those five or more priced towns share are drawn. */
const WORDS = ["Lake", "Beach", "Point", "City", "Heights", "Hills", "Ridge", "Glen", "Haven", "Harbor", "Field", "River", "Park", "Wood", "Ville", "Brook", "Mount", "Spring", "Valley", "Grove", "Bridge", "Green", "Saddle", "Old", "New", "North", "South", "East", "West", "Upper", "Lower", "Port", "Ocean", "Bay", "Pine", "Oak", "Maple", "Cedar"];
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function WhatsInANamePage() {
  const towns = await storyTowns([PRICE]);
  const words = wordPremiums(towns, WORDS);
  const reach = Math.max(0.3, ...words.map((w) => Math.abs(w.premium)));
  const w = (p: number) => `${Math.round((Math.abs(p) / reach) * 5000) / 100}%`;
  return (
    <StoryShell
      title="What’s in a name?"
      lede="Every word that five or more New Jersey town names share, and whether towns carrying it are dearer or cheaper than their own county's other towns. Right of the line, pricier; left, cheaper."
      note={<>Price: Zillow&rsquo;s typical home value, each town against the average of its own county, so &ldquo;Beach&rdquo; is not simply standing in for &ldquo;Monmouth&rdquo;. A word matches anywhere in the name, so &ldquo;Wood&rdquo; takes in Ridgewood and Wood-Ridge alike. Groups this small swing on one or two towns: for fun, not for a decision.</>}
    >
      <ul className="diverging" aria-label="Diverging bars: each word in town names by how much pricier or cheaper its towns are than their county.">
        <li className="ladder-axis" aria-hidden="true"><span>Word in the name</span><span className="track"><span>← cheaper than the county</span><span>pricier →</span></span><span className="num">Premium</span></li>
        {words.map((x) => (
          <li key={x.word}>
            <span><b>{x.word}</b><small>{x.towns.length} towns</small></span>
            <span className="track" title={x.towns.map((t) => t.name).join(", ")}>
              <i className={x.premium >= 0 ? "up" : "down"} style={{ width: w(x.premium) }} />
            </span>
            <span className="num">{pct(x.premium)}</span>
          </li>
        ))}
      </ul>
      <details className="story-details">
        <summary>The towns behind each word</summary>
        <table className="story-table">
          <tbody>
            {words.map((x) => (
              <tr key={x.word}><th scope="row">{x.word}</th><td>{x.towns.map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link href={regionPath(t.id)}>{t.name}</Link></span>)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </StoryShell>
  );
}
