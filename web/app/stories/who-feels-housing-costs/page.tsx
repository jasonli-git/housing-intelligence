import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { IncomePressure } from "@/components/IncomePressure";
import { api, artifactUrl } from "@/lib/api";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { pageMetadata } from "@/lib/meta";
import "../../horizon-theme.css";
import "../../income-pressure.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({ title: "Who feels housing costs most? — Housing", description: "Housing-cost burden by HUD area family-income band. Explore renters and owners for a town, county or ZIP where survey records are available.", path: "/stories/who-feels-housing-costs" });

export default async function HousingCostPressurePage() {
  const [initial, statewide] = await Promise.all([initialPlaceStory("pressure"), api.housingPressure(1)]);
  return <StoryShell title="Who feels housing costs most?"
    focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl} />}
    lede="Choose renters or owners. Each bar shows the share spending over 30% of income on housing within one income band. Tap a band to understand its benchmark."
    note="HUD CHAS uses Census ACS estimates. Income bands use HUD area median family income adjusted for household size, not a town’s median household income. Uncomputed cases stay in the denominator; margins are 90%. Group estimates do not predict a household’s costs or program eligibility.">
    {statewide ? <IncomePressure data={statewide} idPrefix="state-" /> : <p>Statewide housing-cost burden records are unavailable.</p>}
  </StoryShell>;
}
