import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";

export type PropertyScale={parcels:number;transactions:number;archives:string[]};
/** Generated before every build from landed records; never a committed snapshot. */
export function propertyScale():PropertyScale|null {
  const path=join(process.cwd(),".property-scale.json");
  if(!existsSync(path)) return null;
  const data=JSON.parse(readFileSync(path,"utf8")) as PropertyScale;
  if(!Number.isSafeInteger(data.parcels)||data.parcels<=0||!Number.isSafeInteger(data.transactions)||data.transactions<=0||!Array.isArray(data.archives)||!data.archives.every(a=>/^\d{4}(ytd)?$/.test(a))) throw new Error("Invalid property scale artifact");
  return data;
}
