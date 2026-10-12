import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {DataScale,ScaleSignature} from "./DataScale";
it("renders exact static counts and explains the different denominators",()=>{
 const html=renderToStaticMarkup(<DataScale stats={{sources:42,observations:964486,places:1183,measures:170}} />);
 expect(html).toContain("964,486");expect(html).toContain("1,183");
 expect(html).toContain("not a live counter");expect(html).toContain("not one-to-one records");
 expect(html).toContain("not raw rows processed");expect(html).toContain('href="/freshness"');
 expect(html).toContain('aria-hidden="true"');
 expect(html).not.toContain("Many sources. One clearer picture.");
});
it("abbreviates the signature while keeping exact totals in the disclosure",()=>{
 const stats={sources:48,observations:964486,places:1183,measures:173};
 const properties={parcels:3480497,transactions:1398840,archives:["2020","2026ytd"]};
 const html=renderToStaticMarkup(<ScaleSignature stats={stats} properties={properties} />);
 expect(html).toContain("3.48M");expect(html).toContain("1.40M");
 expect(html).toContain("rounded counts");expect(html).toContain("datasets");
 expect(renderToStaticMarkup(<ScaleSignature stats={null} />)).toBe("");
});
it("omits unavailable statistics rather than inventing a fallback",()=>{
 expect(renderToStaticMarkup(<DataScale stats={null} />)).toBe("");
});
it("leads with deduplicated property records without calling them deed documents",()=>{
 const html=renderToStaticMarkup(<DataScale stats={{sources:42,observations:964486,places:1183,measures:173}} properties={{parcels:3480497,transactions:1398840,archives:["2020","2026ytd"]}} />);
 expect(html).toContain("3,480,497");expect(html).toContain("1,398,840");
 expect(html).toContain("Property sales records");expect(html).toContain("2026 YTD");
 expect(html).toContain("non-market transfers");expect(html).toContain("not deed documents");
 expect(html).toContain("964,486 dated metric records");
});
