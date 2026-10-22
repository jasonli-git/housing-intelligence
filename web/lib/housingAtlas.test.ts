import {expect,it} from "vitest";
import {atlasColor,atlasDifference,atlasQuintileColor,atlasValue,atlasReading,ATLAS_COLORS,quintileBreaks,type AtlasMeasure} from "./housingAtlas";
const row={id:5,name:"Atlantic County",rank:1,of:21,change:20,latest:300000};
const measure:AtlasMeasure={metric_id:"zhvi_sfr",label:"Home value",unit:"usd",direction:"neutral",source:"Zillow",sourceUrl:"",definition:"",windows:{"5y":{start:"2021-08-31",end:"2026-08-31",rows:[row]}},latest:{start:null,end:"2026-09-30",rows:[{...row,latest:310000}],periods:{5:"2026-09-30"}}};
it("latest uses actual latest records, not the change window endpoint",()=>{expect(atlasReading(measure,"latest")?.rows[0].latest).toBe(310000);expect(atlasReading(measure,"5y")?.rows[0].latest).toBe(300000);});
it("does not silently substitute latest for an unavailable window",()=>{expect(atlasReading(measure,"10y")).toBeNull();});
it("missing figures are distinct from valid zero",()=>{expect(atlasValue(undefined,"latest")).toBeNull();expect(atlasValue({...row,latest:0},"latest")).toBe(0);expect(atlasColor(null,[0,1])).toBe("url(#atlas-missing)");expect(atlasColor(0,[0,1])).toBe(ATLAS_COLORS[0]);});
it("latest and change read different fields",()=>{expect(atlasValue(row,"latest")).toBe(300000);expect(atlasValue(row,"5y")).toBe(20);});
it("flat scales are neutral and signed values remain ordered",()=>{expect(atlasColor(7,[7,7])).toBe(ATLAS_COLORS[2]);expect(atlasColor(-10,[-10,0,10])).toBe(ATLAS_COLORS[0]);expect(atlasColor(10,[-10,0,10])).toBe(ATLAS_COLORS[4]);});
it("non-finite values are missing",()=>{expect(atlasValue({...row,latest:NaN},"latest")).toBeNull();expect(atlasValue({...row,change:Infinity},"5y")).toBeNull();});
it("compares only published figures at matching dates",()=>{
 const two={...measure,latest:{...measure.latest,periods:{5:'2026-09-30',6:'2026-09-30'},rows:[{...row,latest:310000},{...row,id:6,latest:320000}]}};
 expect(atlasDifference(two,'latest',5,6).value).toBe(10000);
 expect(atlasDifference({...two,latest:{...two.latest,periods:{5:'2026-08-31',6:'2026-09-30'}}},'latest',5,6).value).toBeNull();
 expect(atlasDifference(two,'latest',5,999).value).toBeNull();
 expect(atlasDifference(two,'10y',5,6).value).toBeNull();
});
it("a skewed level is shaded by fifths, not stretched by its outlier",()=>{
  const values=[1,2,3,4,5,6,7,8,9,100];
  const breaks=quintileBreaks(values);
  expect(breaks).toEqual([3,5,7,9]);
  expect(atlasQuintileColor(2,breaks)).toBe(ATLAS_COLORS[0]);
  expect(atlasQuintileColor(8,breaks)).toBe(ATLAS_COLORS[3]);
  expect(atlasQuintileColor(100,breaks)).toBe(ATLAS_COLORS[4]);
  expect(atlasQuintileColor(null,breaks)).toBe("url(#atlas-missing)");
});
