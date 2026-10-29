import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { artifactUrl } from "@/lib/api";
import { PriceLadder } from "@/components/PriceLadder";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { ladder } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The price ladder — Housing",
  description: "Every New Jersey town's starter home, typical home and recent sale prices on one scale.",
  path: "/stories/price-ladder",
});

export default async function PriceLadderPage() {
  const initial = await initialPlaceStory("sales");
  const towns = await storyTowns();
  const rows = ladder(towns);
  const counties = [...new Set(rows.map((r) => r.countyName))].sort();
  return (
    <StoryShell title="The price ladder"
      focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl} />}
      lede="Three prices for every town, priciest first: starter-home value, typical-home value and recorded sales. A sale ring right of the typical-value dot means the homes that sold had a higher median price."
      note={<>
          Starter and typical homes: Zillow&rsquo;s values for the cheapest third and the middle third of homes, houses
          and condos together. Median sale: usable one- to four-family sales over the last three years, from the
          state&rsquo;s records. They measure different things, so a gap is information, not an error.
      </>}>
      <PriceLadder rows={rows} counties={counties} />
    </StoryShell>
  );
}
