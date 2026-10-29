import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { UtilityOutageExplorer } from "@/components/LivingStoryExplorers";
import { api,artifactUrl } from "@/lib/api";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { PRIMARY_STATE } from "@/lib/states";
import { pageMetadata } from "@/lib/meta";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata:Metadata=pageMetadata({title:"When the power goes out — Housing",description:"Utility-wide annual outage records with and without major-event days. Explore suppliers, reporting methods and their limits.",path:"/stories/when-the-power-goes-out"});
export default async function UtilityStoryPage(){
  const [initial,statewide]=await Promise.all([initialPlaceStory("utilities"),api.utilities(PRIMARY_STATE.regionId)]);
  return <StoryShell title="When the power goes out" focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
    lede="Compare annual outage records with and without major-event days. These describe electricity companies across New Jersey—not the reliability of one town or address."
    note={<>EIA-861 utility reports. SAIDI is annual minutes without power per customer; SAIFI counts interruptions; CAIDI is restoration time per interruption. Different methods and event exclusions cannot be mixed. Selected-place details retain NJ BPU records, sources and public-records-request context. <a href="https://www.eia.gov/electricity/data/eia861/">EIA annual records</a>.</>}>
    <UtilityOutageExplorer data={statewide} idPrefix="state-"/>
  </StoryShell>;
}
