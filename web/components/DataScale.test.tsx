import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {DataScale} from "./DataScale";
it("renders exact static counts and explains the different denominators",()=>{
 const html=renderToStaticMarkup(<DataScale stats={{sources:42,observations:964486,places:1183,measures:170}} />);
 expect(html).toContain("964,486");expect(html).toContain("1,183");
 expect(html).toContain("not a live counter");expect(html).toContain("not one-to-one records");
 expect(html).toContain("not raw rows processed");expect(html).toContain('href="/freshness"');
 expect(html).toContain('aria-hidden="true"');
});
it("omits unavailable statistics rather than inventing a fallback",()=>{
 expect(renderToStaticMarkup(<DataScale stats={null} />)).toBe("");
});
