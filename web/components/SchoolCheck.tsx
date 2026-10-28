import Link from "next/link";
import type {CommunityContext} from "@/lib/api";
import {districtCards,districtResults} from "@/lib/schools";

export function SchoolCheck({data,reportHref}:{data:CommunityContext|null;reportHref:string}) {
  const districts=districtCards(data?.districts??[]);
  return <section id="community-schools-heading" aria-labelledby="school-check-title">
    <h3 id="school-check-title">Check the school district</h3>
    {districts.length?<p>{districts.map(d=>{const r=districtResults(d.boundary.payload.district_id,d.performance,d.status);return r.kind==="merged"?r.into:d.boundary.payload.name;}).join(" · ")}</p>:<p>No district association matched these records.</p>}
    <p>Approximate boundary associations—not school assignments. Confirm the address, grade and enrollment rules with the district.</p>
    <p><a href="https://www.nj.gov/education/schoolperformance/" target="_blank" rel="noreferrer">NJDOE school reports ↗</a> · <Link href={`${reportHref}#report-community`}>District figures & sources →</Link></p>
  </section>;
}
