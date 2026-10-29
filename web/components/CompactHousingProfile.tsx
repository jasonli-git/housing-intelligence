import type {ProfileItem} from "@/lib/verdict";
import {Term} from "./Term";
import {UpdatedMark} from "./UpdatedMark";
import styles from "./CompactHousingProfile.module.css";

/** The housing portrait stays separate from the ranked-measure carousel. */
export function CompactHousingProfile({items,peers,standouts=[]}:{items:ProfileItem[];peers:string;
  /** One or two ranked standouts, shown as figures of the band instead of a rail. */
  standouts?:{id:string;label:string;value:string;rank:string}[]}) {
  if(!items.length)return null;
  const primary=items.filter(item=>["acs_median_hh_income","acs_renter_cost_burden","modiv_median_year_built"].includes(item.metric_id));
  const picked=primary.length?primary:items.slice(0,3);
  const rest=items.filter(item=>!picked.includes(item));
  const figures=(rows:ProfileItem[],portrait=false)=><div className={`${styles.figures}${portrait?` ${styles.portrait}`:""}`}>{rows.map(item=><article key={item.metric_id} className={styles.figure} data-metric={item.metric_id}>
    {/* The earlier "Housing, at a glance" portrait's marks (QuietProfile): decoration only. */}
    {portrait&&item.metric_id==="acs_renter_cost_burden"&&/^\d+(\.\d+)?%$/.test(item.value)&&<div className={styles.dots} aria-hidden="true">
      {Array.from({length:100},(_,i)=><i key={i} className={i<Math.round(Number.parseFloat(item.value))?styles.filled:undefined}/>)}
    </div>}
    {portrait&&item.metric_id==="modiv_median_year_built"&&<svg className={styles.house} aria-hidden="true" viewBox="0 0 240 120" fill="none">
      <path d="M5 110H235M30 110V56L88 14L146 56V110M20 63L88 14L156 63M146 110V72L188 43L229 72V110M68 110V76H99V110M43 64H61V82H43ZM111 64H129V82H111ZM171 77H193V94H171ZM71 27V8H82V19"/>
    </svg>}
    {/* Income's mark (2026-10-29): where the town falls among its peers, highest at the
        right; a band where the survey margin leaves the rank a range. */}
    {portrait&&item.metric_id==="acs_median_hh_income"&&item.context?.rank&&item.context.rank.of>1&&(()=>{
      const {value,of,best=value,worst=value}=item.context.rank;
      const at=(r:number)=>`${(1-(r-1)/(of-1))*100}%`;
      return <div className={styles.rankMark} aria-hidden="true"><i style={{left:at(worst),right:`calc(100% - ${at(best)})`}}/><b style={{left:at(value)}}/><span>lowest</span><span>highest</span></div>;
    })()}
    <div className={styles.label}><Term id={item.metric_id} definition={item.definition} why={null}>{item.label}</Term></div>
    <p className={styles.value}><strong>{item.value}</strong>{item.margin&&<span>{item.margin}</span>}</p>
    {item.context&&<p className={styles.context}>{item.context.words}{item.context.rank&&<> · {item.context.rank.best!==undefined&&item.context.rank.worst!==undefined?`${item.context.rank.best}–${item.context.rank.worst}`:item.context.rank.value} of {item.context.rank.of} {peers}</>}</p>}
    {item.updated&&<div className={styles.revision}><UpdatedMark updated={item.updated}/></div>}
  </article>)}</div>;
  return <section id="place-housing-profile" className={styles.profile} aria-labelledby="place-housing-profile-heading">
    <h3 id="place-housing-profile-heading">Housing profile</h3>
    <div data-profile-primary className={standouts.length?styles.withStandouts:undefined}>{figures(picked,true)}
      {standouts.length>0&&<div className={`${styles.figures} ${styles.portrait} ${styles.standouts}`}>{standouts.map(item=><article key={item.id} className={styles.figure} data-standout={item.id}>
        <div className={styles.label}><span className={styles.standoutTag}>Stands out</span> {item.label}</div>
        <p className={styles.value}><strong>{item.value}</strong></p>
        <p className={styles.context}>{item.rank}</p>
      </article>)}</div>}
    </div>
    {rest.length>0&&<details className={styles.more} data-profile-more>
      <summary>More about the housing here <span aria-hidden="true">+</span></summary>
      {figures(rest)}
    </details>}
  </section>;
}
