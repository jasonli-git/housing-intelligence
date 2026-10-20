import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportFiles} from './lib/publication.mjs';

// Synthetic file-manifest build, not second-state data ingestion or a Next render.
// Mirror a whole NJ-sized place cohort (including ZIPs/reports/RSC) under reserved
// /zz/ paths. Share existing JS/CSS; duplicate the actual state page's own payloads.
const web=fileURLToPath(new URL('../',import.meta.url));
const root=path.resolve(web,process.env.PUBLICATION_ROOT??'out');
const report=JSON.parse(await readFile(path.join(web,'.publication/inventory.json'),'utf8'));
const files=await exportFiles(root),keys=new Set(files.map(f=>f.path));
const added=[];
for(const place of report.byPlace){
 const prefix=place.route.slice(1);
 for(const file of files.filter(f=>f.path===`${prefix}.html`||f.path===`${prefix}.txt`||f.path.startsWith(`${prefix}.segments/`)||f.path.startsWith(`${prefix}/`))){
  const key=`zz/${file.path.slice(prefix.indexOf('/')+1)}`;
  assert(!keys.has(key),`Synthetic path collision: ${key}`);keys.add(key);added.push({...file,path:key});
 }
}
for(const file of files.filter(f=>f.path==='states/new-jersey.html'||f.path==='states/new-jersey.txt'||f.path.startsWith('states/new-jersey/'))){const key=file.path.replace('new-jersey','synthetic');assert(!keys.has(key));keys.add(key);added.push({...file,path:key});}
assert.equal(added.filter(f=>f.path.endsWith('.html')).length,report.byPlace.length*2+1,'Every mirrored place retains HTML and report; state retained');
const projected=files.length+added.length;
const aliases=report.groups['legacy aliases']?.files??0;
const scenarios=[
 {name:'current static rules + ZIP-report aliases',files:projected+aliases,staticRules:report.staticRedirects*2,bulkEntries:0},
 {name:'all legacy compatibility external to Pages assets',files:projected-aliases,staticRules:0,bulkEntries:(report.byPlace.length*2+4)*2},
];
for(const s of scenarios){s.pagesFreeFits=s.files<=20000&&s.staticRules<=2000;s.pagesPaidFileCapFits=s.files<=100000;s.bulkFreeFits=s.bulkEntries<=10000;}
// Hold the observed constraint, not a fake success claim. More place payloads alone
// exceed Free even when all alias files and Pages redirect rules are removed.
assert(projected-aliases>20000,'Revisit capacity conclusion: mirrored cohort now fits Free');
const result={kind:'synthetic manifest build; not a rendered second state',baseFiles:files.length,mirroredPlaces:report.byPlace.length,addedCanonicalFiles:added.length,addedCanonicalBytes:added.reduce((n,f)=>n+f.bytes,0),scenarios};
await writeFile(path.join(web,'.publication/synthetic-capacity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
