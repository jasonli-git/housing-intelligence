import {renderToStaticMarkup} from "react-dom/server";
import {it,expect} from "vitest";
import type {SimilarPlaces} from "@/lib/api";
import {CompactAlternatives} from "./CompactAlternatives";
const figure=(value:number|null,period_end="2026-06-30")=>({metric_id:'sr1a_median_sale_price',value,period_end,unit:'usd',label:'Median sale'});
const data={region_id:224,level:'municipality',measures:[],price:'sr1a_median_sale_price',commute:'acs_mean_commute_minutes',context:[],min_sales:20,cheaper_by:.9,commute_minutes:10,price_from:'2024-01-01',price_to:'2026-06-30',here:{region_id:224,name:'Here',figures:[figure(1000000)]},matches:[{region_id:458,name:'Fixture town',figures:[figure(500000)]}]} as SimilarPlaces;
it("shows a measured price difference and keeps methodology secondary",()=>{
 const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={data}/>);
 expect(html).toContain('50% lower');expect(html).toContain('January 2024 to June 2026');expect(html).toContain('not schools or safety');expect(html).toContain('Matching details');expect(html).toContain('<table');expect(html).toContain('This place');
});
it("keeps the original place, all matching traits and commute visible beside the quick summaries",()=>{
 const ids=['acs_share_detached','acs_homeownership_rate','acs_with_children_share','transit_rail_homes_share','acs_mean_commute_minutes'];
 const figures=ids.map((metric_id,i)=>({metric_id,value:i===4?24:.5,unit:i===4?'minutes':'ratio',period_end:'2024-12-31',label:metric_id}));
 const input={...data,measures:ids.slice(0,4),here:{...data.here,figures:[...data.here.figures,...figures]},matches:[{...data.matches[0],figures:[...data.matches[0].figures,...figures.map(f=>({...f,value:f.metric_id==='transit_rail_homes_share'?0:f.value}))]}]};
 const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={input}/>);
 for(const text of ['Detached homes','Owner-occupied homes','Households with children','Homes within ½ mile of rail','Mean one-way commute','ACS 2024'])expect(html).toContain(text);
 expect((html.match(/<tr>/g)??[])).toHaveLength(7);
});
it("does not claim savings from missing, zero, higher or differently dated prices",()=>{
 for(const f of [figure(null),figure(0),figure(1500000),figure(500000,'2025-06-30')]){
  const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={{...data,matches:[{...data.matches[0],figures:[f]}]}}/>);
  expect(html).toContain('No qualifying lower-price match');expect(html).not.toContain('% lower</b>');
 }
});
it("includes all five matches in the table while retaining three quick summaries",()=>{
 const matches=Array.from({length:5},(_,i)=>({...data.matches[0],region_id:458+i,name:`Match ${i+1}`}));
 const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={{...data,matches}}/>);
 const table=html.slice(html.indexOf('<table'),html.indexOf('</table>'));
 for(const match of matches)expect(table).toContain(match.name);
 expect((table.match(/scope="col"/g)??[])).toHaveLength(7);
 expect((html.slice(html.indexOf('<ul>'),html.indexOf('</ul>')).match(/<li>/g)??[])).toHaveLength(3);
});
