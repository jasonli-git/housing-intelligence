import Link from "next/link";
import type {CommunityContext} from "@/lib/api";
import {districtCards,districtResults} from "@/lib/schools";

export function SchoolCheck({data,reportHref,line=false,guideHref}:{data:CommunityContext|null;reportHref:string;
  /** One line inside About this place, its qualification kept beside the name. */
  line?:boolean;
  /** The buyer's guide address checks, offered after it on the line. */
  guideHref?:string}) {
  const districts=districtCards(data?.districts??[]);
  const names=districts.map(d=>{const r=districtResults(d.boundary.payload.district_id,d.performance,d.status);return r.kind==="merged"?r.into:d.boundary.payload.name;}).join(" · ");
  if(line)return <p id="community-schools-heading" className="school-line"><strong>School district:</strong> {names||"no district matched these records"} <span>(approximate boundary, not school assignments)</span> · <a href="https://www.nj.gov/education/schoolperformance/" target="_blank" rel="noreferrer">NJDOE school reports ↗</a> · <Link href={`${reportHref}#report-community`}>District figures →</Link>{guideHref&&<><br/>Checking a specific home? <Link href={guideHref}>Open the buyer’s guide checks →</Link></>}</p>;
  return <section id="community-schools-heading" aria-labelledby="school-check-title">
    <h3 id="school-check-title">Check the school district</h3>
    {districts.length?<p>{districts.map(d=>{const r=districtResults(d.boundary.payload.district_id,d.performance,d.status);return r.kind==="merged"?r.into:d.boundary.payload.name;}).join(" · ")}</p>:<p>No district association matched these records.</p>}
    <p>Approximate boundary associations—not school assignments. Confirm the address, grade and enrollment rules with the district.</p>
    <p><a href="https://www.nj.gov/education/schoolperformance/" target="_blank" rel="noreferrer">NJDOE school reports ↗</a> · <Link href={`${reportHref}#report-community`}>District figures & sources →</Link></p>
  </section>;
}
