import {StoryShell} from "@/components/StoryShell";
import {PlaceStoryFocus} from "@/components/PlaceStoryFocus";
import {CommunityContext} from "@/components/CommunityContext";
import {api,artifactUrl} from "@/lib/api";
import {initialPlaceStory} from "@/lib/placeStoryData";
import {PRIMARY_STATE} from "@/lib/states";
import {pageMetadata} from "@/lib/meta";
import "../../horizon-theme.css";
import "../stories.css";
export const metadata=pageMetadata({title:"Health in context — Housing",description:"Explore CDC PLACES health estimates with geography, measurement populations and uncertainty visible.",path:"/stories/health-in-context"});
export default async function HealthStoryPage(){
  const [initial,state]=await Promise.all([initialPlaceStory("health"),api.community(PRIMARY_STATE.regionId)]);
  return <StoryShell title="Health in context" focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
    lede="Choose a place to explore the health estimates matched to it. A county estimate describes the county, not each town or home."
    note={<>CDC PLACES model-based crude prevalence. Each measure names its adult population. Estimates are not diagnoses, neighborhood scores or direct headcounts; do not compare releases as trends. <a href="https://www.cdc.gov/places/">CDC methodology</a>.</>}>
    <CommunityContext data={state} level="state" topics={["health"]}/>
  </StoryShell>;
}
