import Link from "next/link";
import type {DataScale as Scale} from "@/lib/dataScale";

export function DataScale({stats}:{stats:Scale|null}) {
  if(!stats) return null;
  const number=(n:number)=>n.toLocaleString("en-US");
  return <section className="data-scale" aria-labelledby="data-scale-heading">
    <header><div><span className="scale-kicker">Behind the picture</span><h2 id="data-scale-heading">Many sources. One clearer picture.</h2></div><p>Public records, brought together.</p></header>
    <svg className="scale-tapestry" viewBox="0 0 900 130" fill="none" aria-hidden="true">
      <g className="scale-records">{Array.from({length:72},(_,i)=><rect key={i} x={15+(i%12)*12} y={15+Math.floor(i/12)*16} width="5" height="9" rx="1" />)}</g>
      <g className="scale-streams">{[25,48,71,94].map((y,i)=><path key={y} pathLength="100" d={`M165 ${y} C260 ${y} 295 ${40+i*15} 380 ${40+i*15} H520 C610 ${40+i*15} 650 ${y} 735 ${y}`} />)}</g>
      <g className="scale-ledger">{Array.from({length:9},(_,i)=><path key={i} d={`M395 ${25+i*10} h110 m-110 0 v3 m110-3v3`} />)}<path d="M425 20v100m50-100v100" /></g>
      <g className="scale-places">{Array.from({length:12},(_,i)=>{const x=755+(i%6)*22,y=25+Math.floor(i/6)*50;return <path key={i} d={`M${x} ${y+12}l8-9 8 9v17h-16Z m5 17v-9h6v9`} />;})}</g>
    </svg>
    <dl className="scale-counts">
      <div><dt>Data sources</dt><dd><span className="scale-value">{number(stats.sources)}</span><small>With dated records loaded</small></dd></div>
      <div><dt>Dated metric records</dt><dd><span className="scale-value">{number(stats.observations)}</span><small>Across {number(stats.measures)} measures</small></dd></div>
      <div><dt>Places to explore</dt><dd><span className="scale-value">{number(stats.places)}</span><small>New Jersey · counties, towns &amp; ZIP areas</small></dd></div>
    </dl>
    <details className="scale-definitions"><summary>What these counts mean</summary>
      <p>Calculated from the data available at build time—not a live counter. Sources have dated metric, infrastructure or community records loaded; unfetched sources and raw map layers are not counted. Metric records count dated observations in the warehouse across loaded geographies, including national/state series and calculated measures—not raw rows processed, independent measurements or individual homes.</p>
      <p>Places count New Jersey county, municipality and ZIP pages with at least one metric observation. Coverage varies: a page does not mean every measure is available. The artwork illustrates assembly; its marks are not one-to-one records or a trace of individual homes.</p>
      <nav aria-label="Explore data provenance"><Link href="/freshness">How current are the sources?</Link><Link href="/changes">Which figures changed?</Link></nav>
    </details>
  </section>;
}
