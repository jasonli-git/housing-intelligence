import type {ProfileItem} from "@/lib/verdict";
import {Term} from "./Term";
import {UpdatedMark} from "./UpdatedMark";
import styles from "./CompactHousingProfile.module.css";

/** The housing portrait stays separate from the ranked-measure carousel. */
export function CompactHousingProfile({items,peers}:{items:ProfileItem[];peers:string}) {
  if(!items.length)return null;
  const primary=items.filter(item=>["acs_median_hh_income","acs_renter_cost_burden","modiv_median_year_built"].includes(item.metric_id));
  const picked=primary.length?primary:items.slice(0,3);
  const rest=items.filter(item=>!picked.includes(item));
  const figures=(rows:ProfileItem[])=><div className={styles.figures}>{rows.map(item=><article key={item.metric_id} className={styles.figure} data-metric={item.metric_id}>
    <div className={styles.label}><Term id={item.metric_id} definition={item.definition} why={null}>{item.label}</Term></div>
    <p className={styles.value}><strong>{item.value}</strong>{item.margin&&<span>{item.margin}</span>}</p>
    {item.context&&<p className={styles.context}>{item.context.words}{item.context.rank&&<> · {item.context.rank.best!==undefined&&item.context.rank.worst!==undefined?`${item.context.rank.best}–${item.context.rank.worst}`:item.context.rank.value} of {item.context.rank.of} {peers}</>}</p>}
    {item.updated&&<div className={styles.revision}><UpdatedMark updated={item.updated}/></div>}
  </article>)}</div>;
  return <section id="place-housing-profile" className={styles.profile} aria-labelledby="place-housing-profile-heading">
    <h2 id="place-housing-profile-heading">Housing at a glance</h2>
    <div data-profile-primary>{figures(picked)}</div>
    {rest.length>0&&<details className={styles.more} data-profile-more>
      <summary>More about the housing here <span aria-hidden="true">+</span></summary>
      {figures(rest)}
    </details>}
  </section>;
}
