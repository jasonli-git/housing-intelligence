import Link from "next/link";
import type {SimilarPlaces} from "@/lib/api";
import {regionPath} from "@/lib/placeRoutes";
import {MAX_PLACES,placesQuery} from "@/lib/compare";
import {formatMetric} from "@/lib/format";
import {priceWindow,similarGroups} from "@/lib/similar";
import {periodLabel} from "@/lib/periods";
import styles from "./PlaceComparisons.module.css";

export function CompactAlternatives({name,data}:{name:string;data:SimilarPlaces|null}){
  if(!data)return null;
  const base=data.here.figures.find(f=>f.metric_id===data.price);
  const matches=data.matches.flatMap(place=>{const price=place.figures.find(f=>f.metric_id===data.price);return base&&base.value!==null&&base.value>0&&Number.isFinite(base.value)&&price&&price.value!==null&&price.value>0&&Number.isFinite(price.value)&&price.value<base.value&&base.period_end&&price.period_end===base.period_end?[{place,price,less:Math.round((1-price.value/base.value)*100)}]:[];});
  const zip=data.level==="zip";
  const matched=similarGroups(data)[0].rows.map(r=>r.label.toLowerCase());
  const shown=matches.slice(0,3);
  const places=[data.here,...matches.map(m=>m.place)];
  const labels:Record<string,string>={sr1a_median_sale_price:"Median sale price",acs_share_detached:"Detached homes",acs_homeownership_rate:"Owner-occupied homes",acs_with_children_share:"Households with children",transit_rail_homes_share:"Homes within ½ mile of rail",acs_mean_commute_minutes:"Mean one-way commute"};
  const rows=[...new Set([data.price,...data.measures,data.commute])].flatMap(id=>{
    const basis=data.here.figures.find(f=>f.metric_id===id);
    return basis?[{id,basis,label:labels[id]??basis.label,values:places.map(p=>p.figures.find(f=>f.metric_id===id))}]:[];
  });
  return <section className={styles.alternatives} aria-labelledby="similar-places-heading">
    <header><h2 id="similar-places-heading">{zip?"Similar ZIPs, lower home values":"Similar places, lower sale prices"}</h2><Link href={`/compare${placesQuery([data.here.region_id,...matches.map(m=>m.place.region_id)].slice(0,MAX_PLACES))}`}>Compare places →</Link></header>
    {matches.length?<ul>{shown.map(({place,price,less})=><li key={place.region_id}>
      <Link className={zip?"destination-zip":"destination-town"} href={regionPath(place.region_id)}>{place.name} ↗</Link>
      <p><b>{less}% lower</b> · {formatMetric(price.value!,price.unit,data.price)}</p>
    </li>)}</ul>:<p className={styles.note}>No qualifying lower-price match for {name}. Missing prices are not treated as zero.</p>}
    <p className={styles.note}>{zip?"Typical home-value estimates":"Median qualifying sales"}{priceWindow(data)?` · ${priceWindow(data)}`:""}{!zip?` · at least ${data.min_sales} sales per town`:""}. {matches.length>3?`Three highlights; all ${matches.length} matches below.`:""}</p>
    {matches.length>0&&<>
      <h4 className={styles.matchHeading}>The match, side by side</h4>
      <p className={styles.note}>At least {Math.round((1-data.cheaper_by)*100)}% lower prices; commute no more than {data.commute_minutes} minutes longer. Similarity uses the housing measures below—not schools or safety.</p>
      <div className={styles.matchScroll} tabIndex={0} role="region" aria-label={`Compare matching characteristics with ${name}`}>
        <table className={styles.matchTable}>
          <caption className="visually-hidden">{name} and {matches.length} lower-price {matches.length===1?"match":"matches"}: prices, matching characteristics and commute. Dates belong to each measure.</caption>
          <thead><tr><th scope="col">Measure</th>{places.map((p,i)=><th key={p.region_id} scope="col">{i===0?<>{name}<small>This place</small></>:<Link href={regionPath(p.region_id)}>{p.name}</Link>}</th>)}</tr></thead>
          <tbody>{rows.map(({id,basis,label,values})=><tr key={id}>
            <th scope="row">{label}{id!==data.price&&<small>{basis.period_end?`${id.startsWith("acs_")?"ACS ":""}${periodLabel(basis.period_end,id)}`:"Date unavailable"}</small>}</th>
            {values.map((f,i)=><td key={places[i].region_id}>{f?.value!==null&&f?.value!==undefined&&Number.isFinite(f.value)?formatMetric(f.value,f.unit,id):"—"}{f&&f.period_end!==basis.period_end&&<small>{f.period_end?periodLabel(f.period_end,id):"Date unavailable"}</small>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </>}
    <details className={styles.method}><summary>Matching details</summary><p>Matched on {matched.join(", ")}. Price must be at least {Math.round((1-data.cheaper_by)*100)}% lower, with a commute no more than {data.commute_minutes} minutes longer.{!zip&&` Towns need at least ${data.min_sales} qualifying sales.`} This is a measured match, not a recommendation.</p></details>
  </section>;
}
