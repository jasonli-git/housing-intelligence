"use client";
import type { Inputs } from "@/lib/ownership";
import { twoPaths } from "@/lib/twoPaths";
import { formatValue } from "@/lib/format";
import { DOWN_PAYMENTS } from "@/lib/cost";

export function TwoPaths({input,onYears,onPrice,onDown,onRate,onUpkeep,onFlat}: {
  input:Inputs;onYears:(n:number)=>void;onPrice:(n:number)=>void;onDown:(n:number)=>void;
  onRate:(n:number)=>void;onUpkeep:(n:number)=>void;onFlat:()=>void;
}) {
  const {points,selected,principalPaid,valueChange,spent,down}=twoPaths(input);
  const money=(n:number)=>formatValue(n,"usd");
  const values=points.flatMap(p=>[p.net,p.rent??0]);
  const low=Math.min(0,...values), high=Math.max(1,...values), width=640, height=190;
  const x=(year:number)=>24+(year-1)/29*(width-48);
  const y=(value:number)=>16+(high-value)/(high-low)*(height-40);
  const path=(own:boolean)=>points.map((p,i)=>`${i?"L":"M"}${x(p.years)},${y(own?p.net:p.rent??0)}`).join(" ");
  const flat=input.appreciationPct===0&&input.rentGrowthPct===0;
  return <section className="two-paths" aria-label="One home, two paths">
    <div className="paths-head"><h3>One home, two paths</h3><span>{flat?"No growth assumed":"Growth scenario—not a prediction"}</span></div>
    <p className="paths-intro">Change a figure. Move through the years. See where the costs go.</p>
    <div className="paths-controls">
      <label>Try a purchase price<input type="number" min="1" value={input.price} onChange={e=>{const n=Number(e.target.value);if(e.target.value&&n>0&&Number.isFinite(n))onPrice(n);}} /></label>
      <label>Try a down payment<select value={input.downPct} onChange={e=>onDown(Number(e.target.value))}>{DOWN_PAYMENTS.map(n=><option value={n} key={n}>{n}%{n===3.5?" (FHA)":""}</option>)}</select></label>
      <label>Try a mortgage rate<input type="number" min="0.01" max="19.99" step="0.1" value={input.ratePct} onChange={e=>{const n=Number(e.target.value);if(e.target.value&&n>0&&n<20)onRate(n);}} /></label>
      <label>Upkeep, % of price / year<input type="number" min="0" step="0.1" value={input.upkeepPct} onChange={e=>{const n=Number(e.target.value);if(e.target.value&&n>=0&&Number.isFinite(n))onUpkeep(n);}} /></label>
    </div>
    <figure className="paths-figure"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Thirty-year scenario: cost of owning then selling compared with rent paid. Use the year slider for exact figures.">
      <line className="paths-zero" x1="24" x2="616" y1={y(0)} y2={y(0)}/>
      <path className="paths-own" d={path(true)}/><path className="paths-rent" d={path(false)}/>
      <line className="paths-marker" x1={x(selected.years)} x2={x(selected.years)} y1="12" y2="166"/>
      <circle className="paths-own" cx={x(selected.years)} cy={y(selected.net)} r="5"/>
      <circle className="paths-rent" cx={x(selected.years)} cy={y(selected.rent??0)} r="5"/>
      <text x="24" y="187">Year 1</text><text x="616" y="187" textAnchor="end">Year 30</text>
    </svg><figcaption><span className="paths-own-key">Own, then sell: {money(selected.net)}</span><span className="paths-rent-key">Rent paid: {money(selected.rent??0)}</span><small>Same dollar scale, cumulative costs. Owning’s line subtracts what selling returns; it can fall below zero under growth assumptions.</small></figcaption></figure>
    <label className="paths-scrub">Explore year <b>{selected.years}</b><input type="range" min="1" max="30" value={selected.years} onChange={e=>onYears(Number(e.target.value))}/></label>
    <div className="paths-readouts">
      <article><h4>Owning</h4><dl><div><dt>Money spent, including sale fees</dt><dd>{money(spent)}</dd></div><div><dt>Principal paid down</dt><dd>{money(principalPaid)}</dd></div><div><dt>Assumed home-value change</dt><dd>{money(valueChange)}</dd></div><div><dt>{selected.equity<0?"Cash needed to sell":"Cash back if sold"}</dt><dd>{money(Math.abs(selected.equity))}</dd></div></dl><small>Sale price minus remaining loan and selling costs. This is not all profit: it includes your down payment and repaid principal.</small></article>
      <article><h4>Renting</h4><dl><div><dt>Rent spent</dt><dd>{money(selected.rent??0)}</dd></div><div><dt>Down payment not tied up</dt><dd>{money(down)}</dd></div></dl><small>No investment return assumed. This is not remaining savings: rental deposits, moving costs and how you use that cash are not modelled.</small></article>
    </div>
    <div className="paths-assumptions"><p>Home prices: {input.appreciationPct}% / year · rent: {input.rentGrowthPct}% / year. Other recurring costs stay flat. Utilities are left out of both paths.</p>{!flat&&<button type="button" onClick={onFlat}>Try no growth</button>}</div>
    {selected.missing.length>0&&<p className="paths-warning">Incomplete costs: {selected.missing.join(", ")}. Missing is not zero.</p>}
    <p className="paths-limit">A scenario, not a prediction or recommendation. The area’s typical rental and single-family house may be different homes. Change rent and other quotes in the guide’s existing fields.</p>
  </section>;
}
