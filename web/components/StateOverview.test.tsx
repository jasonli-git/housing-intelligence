import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import type {LevelReading} from "@/lib/api";
import {StateOverview} from "./StateOverview";
it("keeps basis, period and reporting coverage available in the compact snapshot",()=>{
 const row=(metric_id:string,value:number,unit:string)=>({metric_id,value,unit,period_start:"2025-01-01",period_end:"2025-12-31"}) as LevelReading;
 const html=renderToStaticMarkup(<StateOverview levels={[row("sr1a_median_sale_price_12m",500000,"usd"),row("nj_net_units_added",100,"count"),row("nj_certificates_reporting_share",.8,"share"),row("nj_demolitions_reporting_share",.7,"share")]} mortgage={{value:6.5,metric_id:"MORTGAGE30US",period_start:"2026-10-01"}} preliminaryYears={[2025]} />);
 expect(html).toContain("Median sold-home price");expect(html).toContain("US average");
 expect(html).toContain("Reporting towns only");expect(html).toContain("preliminary");
 expect(html).toContain("80% for completions, 70% for demolitions");
 expect(html).toContain("not the value of every home");
 expect(html).toContain("not a local rate or a lender quote");
});
