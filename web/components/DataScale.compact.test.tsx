import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {DataScale} from "./DataScale";
it("gives the compact information control an accessible name and retains full definitions",()=>{
 const html=renderToStaticMarkup(<DataScale stats={{sources:48,observations:964486,places:1183,measures:173}} compactSummary />);
 expect(html).toContain('aria-label="About these figures"');
 expect(html).toContain('aria-hidden="true">ⓘ');
 expect(html).toContain("964,486");
 expect(html).toContain("Coverage varies");
});
