import {renderToStaticMarkup} from "react-dom/server";
import {it,expect} from "vitest";
import type {SimilarPlaces} from "@/lib/api";
import {CompactAlternatives} from "./CompactAlternatives";
const figure=(value:number|null,period_end="2026-06-30")=>({metric_id:'sr1a_median_sale_price',value,period_end,unit:'usd',label:'Median sale'});
const data={region_id:224,level:'municipality',measures:[],price:'sr1a_median_sale_price',commute:'acs_mean_commute_minutes',context:[],min_sales:20,cheaper_by:.9,commute_minutes:10,price_from:'2024-01-01',price_to:'2026-06-30',here:{region_id:224,name:'Here',figures:[figure(1000000)]},matches:[{region_id:458,name:'Fixture town',figures:[figure(500000)]}]} as SimilarPlaces;
it("shows a measured price difference and keeps methodology secondary",()=>{
 const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={data}/>);
 expect(html).toContain('50% lower');expect(html).toContain('January 2024 to June 2026');expect(html).toContain('not schools or safety');expect(html).toContain('Matching details');expect(html).not.toContain('<table');
});
it("does not claim savings from missing, zero, higher or differently dated prices",()=>{
 for(const f of [figure(null),figure(0),figure(1500000),figure(500000,'2025-06-30')]){
  const html=renderToStaticMarkup(<CompactAlternatives name="Here" data={{...data,matches:[{...data.matches[0],figures:[f]}]}}/>);
  expect(html).toContain('No qualifying lower-price match');expect(html).not.toContain('% lower</b>');
 }
});
