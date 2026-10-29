import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import type {LevelReading} from "@/lib/api";
import {StateOverview} from "./StateOverview";
it("leads with the sale price, the property tax rate and homes sold, each with its window",()=>{
 const row=(metric_id:string,value:number,unit:string,period_start="2025-01-01",period_end="2025-12-31")=>({metric_id,value,unit,period_start,period_end}) as LevelReading;
 const html=renderToStaticMarkup(<StateOverview levels={[row("sr1a_median_sale_price_12m",500000,"usd"),row("nj_effective_tax_rate",1.87,"rate_per_100"),row("sr1a_sales_count",153655,"count","2024-01-01","2026-06-30"),row("nj_net_units_added",100,"count")]} />);
 expect(html).toContain("Median sold-home price");expect(html).toContain("Effective property tax rate");expect(html).toContain("Homes sold");
 expect(html).toContain("Jan 2024–Jun 2026");
 expect(html).toContain("not one year");
 expect(html).toContain("not the value of every home");
 expect(html).not.toContain("US average");expect(html).not.toContain("Net homes added");
});
