import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FILE_CAP,exportFiles} from './lib/publication.mjs';

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
// Workers static assets on Workers Paid (ARCHITECTURE #454); redirects are the
// Worker's code, so there is no rule budget left to project.
assert(projected<=FILE_CAP,`Two states no longer fit: ${projected} files of ${FILE_CAP}`);
const result={kind:'synthetic manifest build; not a rendered second state',baseFiles:files.length,mirroredPlaces:report.byPlace.length,addedCanonicalFiles:added.length,addedCanonicalBytes:added.reduce((n,f)=>n+f.bytes,0),projectedFiles:projected,fileCap:FILE_CAP,statesThatFit:Math.floor((FILE_CAP-files.length)/added.length)+1};
await writeFile(path.join(web,'.publication/synthetic-capacity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
