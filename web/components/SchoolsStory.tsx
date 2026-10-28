import Link from "next/link";
import type { PlaceStoryRecord } from "@/lib/placeStories";
import { SCHOOL_SHARES, schoolDistrictNames } from "@/lib/schoolPlaceStory";
import { marginLabel } from "@/lib/uncertainty";
import { regionPath } from "@/lib/placeRoutes";
import styles from "./PlaceStories.module.css";

/** Where the children who live in a place go to school: public or private, by grade,
 *  beside the district whose boundary covers it. Residence, not school location. */
export function SchoolsStory({ name, record }: { name: string; record: PlaceStoryRecord }) {
  const districts = schoolDistrictNames(record.community);
  const rows = SCHOOL_SHARES.flatMap(([id, label]) => {
    const l = record.levels.find(x => x.metric_id === id && Number.isFinite(x.value) && x.value >= 0 && x.value <= 1);
    return l ? [{ id, label, value: l.value, margin: marginLabel(l.value, l.margin_of_error ?? null, l.unit, l.metric_id) }] : [];
  });
  return <section className={styles.livingExplorer} aria-labelledby="schools-story-heading">
    <h2 id="schools-story-heading">Where students who live in {name} go</h2>
    {rows.length ? <div className={styles.explorerRows}>{rows.map(r => <div key={r.id}>
      <span>{r.label}</span><b>{Math.round((1 - r.value) * 100)}% public · {Math.round(r.value * 100)}% private</b>
      <i aria-hidden="true"><span style={{ width: `${(1 - r.value) * 100}%` }} /></i>
      {r.margin && <small>Private share 90% margin: {r.margin}</small>}
    </div>)}</div> : <p>No enrollment estimates matched this place. Missing is not zero.</p>}
    <h2>Public does not mean one district</h2>
    <p>{districts.length ? <><strong>{districts.join(" and ")}</strong> {districts.length === 1 ? "is the district" : "are the districts"} whose boundary covers {name}—an approximate boundary, not school assignments.</> : <>No school district boundary matched {name}.</>} The survey also counts as public:</p>
    <ul>
      <li>Charter schools, which can enroll students from several districts.</li>
      <li>County vocational-technical high schools, which admit by application.</li>
      <li>Interdistrict choice schools, which take students from other districts.</li>
      <li>Out-of-district placements a district pays for, such as special education.</li>
    </ul>
    <p>Private covers religious and independent schools, in town or elsewhere.</p>
    <p><a href="https://www.nj.gov/education/schoolperformance/" target="_blank" rel="noreferrer">NJDOE school performance reports ↗</a> · <Link href={`${regionPath(record.place.region_id)}/report#report-community`}>District figures and sources →</Link></p>
  </section>;
}
