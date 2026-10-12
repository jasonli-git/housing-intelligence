import Link from "next/link";
import type {DataScale as Scale} from "@/lib/dataScale";
import type {PropertyScale} from "@/lib/propertyScale";

export function ScaleSignature({stats,properties}:{stats:Scale|null;properties?:PropertyScale|null}) {
  if(!stats) return null;
  const short=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:n.toLocaleString("en-US");
  return <div className="scale-signature" aria-label="Project scale, rounded counts">
    <svg className="signature-flow scale-streams" viewBox="0 0 100 16" fill="none" aria-hidden="true"><path pathLength="100" d="M0 4H25L35 8H65L75 4H100M0 12H25L35 8H65L75 12H100" /></svg>
    {properties?<><span><b>{short(properties.parcels)}</b> parcels</span><span><b>{short(properties.transactions)}</b> sales records</span></>:<span><b>{short(stats.observations)}</b> metric records</span>}
    <span><b>{stats.sources}</b> datasets</span>
  </div>;
}

export function DataScale({stats,properties}:{stats:Scale|null;properties?:PropertyScale|null}) {
  if(!stats) return null;
  const number=(n:number)=>n.toLocaleString("en-US");
  return <section className="data-scale" aria-labelledby="data-scale-heading">
    <h2 id="data-scale-heading" className="sr-only">Behind the picture</h2>
    <details className="scale-definitions"><summary>Behind the picture</summary>
    <svg className="scale-tapestry" viewBox="0 0 900 130" fill="none" aria-hidden="true">
      <g className="scale-records">{Array.from({length:72},(_,i)=><rect key={i} x={15+(i%12)*12} y={15+Math.floor(i/12)*16} width="5" height="9" rx="1" />)}</g>
      <g className="scale-streams">{[25,48,71,94].map((y,i)=><path key={y} pathLength="100" d={`M165 ${y} C260 ${y} 295 ${40+i*15} 380 ${40+i*15} H520 C610 ${40+i*15} 650 ${y} 735 ${y}`} />)}</g>
      <g className="scale-ledger">{Array.from({length:9},(_,i)=><path key={i} d={`M395 ${25+i*10} h110 m-110 0 v3 m110-3v3`} />)}<path d="M425 20v100m50-100v100" /></g>
      <g className="scale-places">{Array.from({length:12},(_,i)=>{const x=755+(i%6)*22,y=25+Math.floor(i/6)*50;return <path key={i} d={`M${x} ${y+12}l8-9 8 9v17h-16Z m5 17v-9h6v9`} />;})}</g>
    </svg>
    <dl className={`scale-counts${properties?" scale-counts-properties":""}`}>
      {properties && <><div><dt>Property parcels</dt><dd><span className="scale-value">{number(properties.parcels)}</span><small>Distinct NJ parcel identifiers</small></dd></div><div><dt>Property sales records</dt><dd><span className="scale-value">{number(properties.transactions)}</span><small>NJ sales-ratio archives {properties.archives[0]}–{properties.archives.at(-1)?.replace("ytd"," YTD")}</small></dd></div></>}
      <div><dt>Source datasets</dt><dd><span className="scale-value">{number(stats.sources)}</span><small>Across the project</small></dd></div>
      {!properties && <div><dt>Dated metric records</dt><dd><span className="scale-value">{number(stats.observations)}</span><small>Across {number(stats.measures)} measures</small></dd></div>}
      <div><dt>Places to explore</dt><dd><span className="scale-value">{number(stats.places)}</span><small>New Jersey · counties, towns &amp; ZIP areas</small></dd></div>
    </dl>
      {properties && <p>{number(stats.observations)} dated metric records across {number(stats.measures)} measures sit behind the analytical views. Parcel totals count distinct nonblank PAMS parcel identifiers in the current landed NJ MOD-IV composite—not annual assessment rows or only residential homes. Sales totals count SR1A reporting records, deduplicated by county, district, serial number and assessment year; they include non-market transfers and records not matched to a place page. These are not deed documents. Archive labels are sales-ratio years (July–June), not calendar-year coverage; YTD is the publisher’s open archive label.</p>}
      <p>Calculated from the data available at build time—not a live counter. Source datasets count the external-source catalogue listed in Data provenance, including supporting maps, directories and uncertainty data—not separate institutions. The platform’s own calculated metrics are excluded. Metric records count dated observations in the warehouse across loaded geographies, including national/state series and calculated measures—not raw rows processed, independent measurements or individual homes.</p>
      <p>Places count New Jersey county, municipality and ZIP pages with at least one metric observation. Coverage varies: a page does not mean every measure is available. The artwork illustrates assembly; its marks are not one-to-one records or a trace of individual homes.</p>
      <nav aria-label="Explore data provenance"><Link href="/freshness">How current are the sources?</Link><Link href="/changes">Which figures changed?</Link></nav>
    </details>
  </section>;
}
