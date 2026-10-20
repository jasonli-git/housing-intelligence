import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportFiles,inventory,legacyManifest,parseRedirects,publishedPlaces,validateCoverage} from './lib/publication.mjs';

const web=fileURLToPath(new URL('../',import.meta.url));
const root=path.resolve(web,process.env.PUBLICATION_ROOT??'out');
// Never inside out/: these are diagnostics/candidates, not public site assets.
const output=path.join(web,'.publication');
const registry=JSON.parse(await readFile(path.join(web,'lib/placeRoutes.json'),'utf8'));
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const origin=new URL(sitemap.match(/<loc>([^<]+)<\/loc>/)[1]).origin;
const rules=parseRedirects(await readFile(path.join(root,'_redirects'),'utf8'));
const places=publishedPlaces(registry,sitemap),entries=legacyManifest(places,rules);
await validateCoverage(root,entries);
const files=await exportFiles(root),report=inventory(files,places,entries,rules.size);
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'package.json'),JSON.stringify({private:true,type:'module'})+'\n');
await writeFile(path.join(output,'inventory.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(output,'legacy-redirects.json'),JSON.stringify({version:1,origin,entries},null,2)+'\n');
// Cloudflare CSV has NO header; only query preservation is enabled, never suffix
// or subdomain matching. HTTP and HTTPS source addresses share the same entry.
await writeFile(path.join(output,'bulk-redirects.csv'),entries.map(e=>`${new URL(e.from,origin).host}${e.from},${origin}${e.to},301,TRUE,FALSE,FALSE,FALSE`).join('\n')+'\n');
const resolver=await readFile(new URL('./lib/legacy-resolver.mjs',import.meta.url),'utf8');
const common=`// GENERATED LOCAL-ONLY CANDIDATE. Not wired into make deploy.\n${resolver}\nconst redirect=createLegacyRedirect(${JSON.stringify(entries.map(({from,to})=>({from,to})))});\n`;
await mkdir(path.join(output,'worker'),{recursive:true});
await writeFile(path.join(output,'worker/index.js'),common+'export default {fetch(request){return redirect(request)??fetch(request);}};\n');
await mkdir(path.join(output,'pages/functions/regions'),{recursive:true});
await writeFile(path.join(output,'pages/functions/regions/[[path]].js'),common+'export function onRequest({request,next}){return redirect(request)??next();}\n');
await writeFile(path.join(output,'pages/_routes.json'),JSON.stringify({version:1,include:['/regions/*'],exclude:[]})+'\n');
console.log(JSON.stringify({...report,byPlace:undefined},null,2));
console.log(`Local diagnostics and three compatibility candidates: ${output}`);
