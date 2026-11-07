import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { StoryWordDots } from "@/components/StoryWordDots";
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
  return (
    <StoryShell
      title="What’s in a name?"
      takeaway={<><b>A &ldquo;{words[0].word}&rdquo; in the name goes with the priciest homes</b>, {pct(words[0].premium)} against the rest of the county; a &ldquo;{words.at(-1)!.word}&rdquo;, with the cheapest, {pct(words.at(-1)!.premium)}.</>}
      lede="Every word that five or more New Jersey town names share, and whether towns carrying it are dearer or cheaper than their own county's other towns. Each grey dot is a town, the coloured dot its word's average; right of the county line, pricier."
      note={<>Price: Zillow&rsquo;s typical home value, each town against the average of its own county, so &ldquo;Beach&rdquo; is not simply standing in for &ldquo;Monmouth&rdquo;. A word matches anywhere in the name, so &ldquo;Wood&rdquo; takes in Ridgewood and Wood-Ridge alike. Groups this small swing on one or two towns: for fun, not for a decision.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <StoryWordDots words={words} />
      </figure>
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
