import type { Metadata } from "next";
import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { api, artifactUrl } from "@/lib/api";
import { marginLabel } from "@/lib/uncertainty";
import styles from "@/components/PlaceStories.module.css";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { pageMetadata } from "@/lib/meta";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata:Metadata=pageMetadata({title:"Where students go — Housing",description:"How many K–12 students who live in a place attend public or private school, beside the district whose boundary covers it.",path:"/stories/where-students-go"});
export default async function SchoolsStoryPage(){
  const [initial,counties]=await Promise.all([initialPlaceStory("schools"),api.values("acs_k12_private_share","county",50)]);
  const rows=[...(counties?.items??[])].filter(c=>Number.isFinite(c.value)&&c.value>=0&&c.value<=1).sort((a,b)=>b.value-a.value);
  const max=Math.max(.01,...rows.map(r=>r.value));
  return <StoryShell title="Where students go" focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
    lede="A town’s school district is not where every child goes. Choose a place to see how many K–12 students who live there attend public or private school."
    note={<>Census ACS 5-year table B14002, children enrolled in kindergarten to grade 12 by where they live. Charter, county vocational and choice schools count as public. Estimates carry 90% margins; small towns’ can be wide. District boundaries are approximate associations from NJDOE, not school assignments. <a href="https://www.nj.gov/education/schoolperformance/">NJDOE school reports</a>.</>}>
    <section className={styles.livingExplorer} aria-labelledby="schools-counties-heading">
      <h2 id="schools-counties-heading">K–12 students at a private school, by county</h2>
      <p>Children enrolled in kindergarten to grade 12, by the county they live in. Bars share one scale; overlapping margins mean two counties cannot be told apart.</p>
      {rows.length?<div className={styles.explorerRows}>{rows.map(c=><div key={c.region_id}><span>{c.name} County</span><b>{Math.round(c.value*100)}%</b><i aria-hidden="true"><span style={{width:`${c.value/max*100}%`}}/></i>{c.margin_of_error!=null&&<small>90% margin: {marginLabel(c.value,c.margin_of_error,"ratio","acs_k12_private_share")}</small>}</div>)}</div>:<p>County estimates are unavailable. Missing is not zero.</p>}
    </section>
  </StoryShell>;
}
