import Link from "next/link";
import type {SimilarPlaces} from "@/lib/api";
import {regionPath} from "@/lib/placeRoutes";
import {MAX_PLACES,placesQuery} from "@/lib/compare";
import {formatMetric} from "@/lib/format";
import {priceWindow,similarGroups} from "@/lib/similar";
import styles from "./PlaceComparisons.module.css";

export function CompactAlternatives({name,data}:{name:string;data:SimilarPlaces|null}){
  if(!data)return null;
  const base=data.here.figures.find(f=>f.metric_id===data.price);
  const matches=data.matches.flatMap(place=>{const price=place.figures.find(f=>f.metric_id===data.price);return base&&base.value!==null&&base.value>0&&Number.isFinite(base.value)&&price&&price.value!==null&&price.value>0&&Number.isFinite(price.value)&&price.value<base.value&&base.period_end&&price.period_end===base.period_end?[{place,price,less:Math.round((1-price.value/base.value)*100)}]:[];});
  const zip=data.level==="zip";
  const matched=similarGroups(data)[0].rows.map(r=>r.label.toLowerCase());
  return <section className={styles.alternatives} aria-labelledby="similar-places-heading">
    <header><h3 id="similar-places-heading">{zip?"Similar ZIPs, lower home values":"Similar places, lower sale prices"}</h3><Link href={`/compare${placesQuery([data.here.region_id,...matches.map(m=>m.place.region_id)].slice(0,MAX_PLACES))}`}>Compare places →</Link></header>
    {matches.length?<ul>{matches.slice(0,3).map(({place,price,less})=>{const feature=place.figures.find(f=>f.metric_id===data.measures[0]),commute=place.figures.find(f=>f.metric_id===data.commute);return <li key={place.region_id}>
      <Link className={zip?"destination-zip":"destination-town"} href={regionPath(place.region_id)}>{place.name} ↗</Link>
      <p><b>{less}% lower</b> · {formatMetric(price.value!,price.unit,data.price)}</p>
      <small>{feature&&feature.value!==null?`${feature.label}: ${formatMetric(feature.value,feature.unit,feature.metric_id)} (${feature.period_end?.slice(0,4)??"date unavailable"})`:"Matched on available housing measures"}{commute&&commute.value!==null?` · ${Math.round(commute.value)}-min commute (${commute.period_end?.slice(0,4)??"date unavailable"})`:""}</small>
    </li>;})}</ul>:<p className={styles.note}>No qualifying lower-price match for {name}. Missing prices are not treated as zero.</p>}
    <p className={styles.note}>{zip?"Typical home-value estimates":"Median qualifying sales"}{priceWindow(data)?` · ${priceWindow(data)}`:""}. Similar means measured housing characteristics—not schools or safety.{matches.length>3?` Showing 3 of ${matches.length} matches.`:""}</p>
    <details className={styles.method}><summary>Matching details</summary><p>Matched on {matched.join(", ")}. Price must be at least {Math.round((1-data.cheaper_by)*100)}% lower, with a commute no more than {data.commute_minutes} minutes longer.{!zip&&` Towns need at least ${data.min_sales} qualifying sales.`} This is a measured match, not a recommendation.</p>{matches.length>3&&<p>Other matches: {matches.slice(3).map(({place},i)=><span key={place.region_id}>{i>0?", ":""}<Link href={regionPath(place.region_id)}>{place.name}</Link></span>)}.</p>}</details>
  </section>;
}
