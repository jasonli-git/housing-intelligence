import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { PlaceStoryChart } from "@/components/PlaceStoryChart";
import { api, artifactUrl } from "@/lib/api";
import { initialPlaceStory, stampPlaceStory } from "@/lib/placeStoryData";
import { makePlaceStoryRecord } from "@/lib/placeStories";
import { PRIMARY_STATE } from "@/lib/states";
import { pageMetadata } from "@/lib/meta";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata:Metadata=pageMetadata({title:"Sites and cleanup — Housing",description:"Open cleanups, sites with ongoing controls and heating-oil tank records. Explore local NJDEP counts without treating them as a property's risk.",path:"/stories/sites-and-cleanup"});
export default async function SitesStoryPage(){
  const [initial,packet]=await Promise.all([initialPlaceStory("sites"),api.packet(PRIMARY_STATE.regionId,"5y")]);
  const statewide=packet?stampPlaceStory(makePlaceStoryRecord("sites",{region_id:packet.region.region_id,name:packet.region.name,level:packet.region.level,state_code:packet.region.state_code},packet.levels)):null;
  return <StoryShell title="Sites and cleanup" focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
    lede="A cleanup record describes a site’s status. Choose a place to see open cleanups, ongoing controls and heating-oil tank records. Categories can overlap."
    note={<>NJDEP’s site records and map copy. Counts do not measure contamination severity, affected homes or exposure at an address. A missing record is not a clean-property finding. <a href="https://experience.arcgis.com/experience/f26272f8a41c4aeea77ac6f9b3c80ebb">Check NJDEP’s site map</a>.</>}>
    {statewide?<PlaceStoryChart record={statewide}/>:<p>Statewide site records are unavailable.</p>}
  </StoryShell>;
}
