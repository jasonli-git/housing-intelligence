import Link from "next/link";
import type {PacketLevel} from "@/lib/api";
import {comparisonMeasures} from "@/lib/placeComparisons";
import {formatMetric} from "@/lib/format";
import {firstEnd,ordinal} from "@/lib/ranks";
import {surveyYears} from "@/lib/periods";
import {marginLabel,type Uncertainties} from "@/lib/uncertainty";
import styles from "./PlaceComparisons.module.css";

export function PlaceComparisonRail({name,peers,levels,uncertainties,reportHref}:{name:string;peers:string;levels:PacketLevel[];uncertainties:Uncertainties;reportHref:string}){
  const items=comparisonMeasures(levels,uncertainties);if(!items.length)return null;
  return <section className={styles.comparisons} aria-labelledby="place-comparisons-heading">
    <header><h3 id="place-comparisons-heading">How it compares</h3><Link href={`${reportHref}#report-current`}>All measures →</Link></header>
    <p className={styles.note}>Current values · {peers}. Lower → higher values; bands include ties and 90% survey rank ranges.</p>
    <ul className={styles.rail} tabIndex={0} aria-label={`Current-value comparisons for ${name}`}>
      {items.map(({row,label,best,worst,position,low,high,margin,rangeMissing})=><li key={row.metric_id}>
        <Link href={`${reportHref}#report-current`} className={styles.tile}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{formatMetric(row.value,row.unit,row.metric_id)} <small>{marginLabel(row.value,margin,row.unit,row.metric_id)}</small></span>
          <span className={styles.rank}>{ordinal(best)}{worst!==best?`–${ordinal(worst)}`:""} of {row.of} · {firstEnd("value",row.direction)}</span>
          <span className={styles.position} aria-hidden="true"><i style={{left:`${low*100}%`,width:`${(high-low)*100}%`}}/><b style={{left:`${position*100}%`}}/></span>
          <span className={styles.period}>ACS {surveyYears(row.period_start,row.period_end)}{rangeMissing?" · rank range unavailable":""}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
