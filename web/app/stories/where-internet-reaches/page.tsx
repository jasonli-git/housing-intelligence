import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { BroadbandStoryExplorer } from "@/components/LivingStoryExplorers";
import { api,artifactUrl } from "@/lib/api";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { PRIMARY_STATE } from "@/lib/states";
import { pageMetadata } from "@/lib/meta";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata:Metadata=pageMetadata({title:"Where internet reaches — Housing",description:"FCC fiber and wired availability, separating mapped serviceable locations from published area-unit summaries. Choose a place and inspect the measurement basis.",path:"/stories/where-internet-reaches"});
export default async function BroadbandStoryPage(){
  const [initial,statewide]=await Promise.all([initialPlaceStory("broadband"),api.community(PRIMARY_STATE.regionId)]);
  return <StoryShell title="Where internet reaches" focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
    lede="Fiber reach depends on what is counted. Switch between serviceable locations and published area units; they are different denominators. Choose a place for the records matched to it."
    note={<>FCC Broadband Data Collection provider reports, with availability and revision dates shown beside the figures. These are offers, not measured speeds, prices, subscribers or a guarantee at a home. Town, Census-place, county and ZIP boundaries are distinct. <a href="https://broadbandmap.fcc.gov/">Check an address on the FCC map</a>.</>}>
    <BroadbandStoryExplorer data={statewide} level="state" idPrefix="state-"/>
  </StoryShell>;
}
