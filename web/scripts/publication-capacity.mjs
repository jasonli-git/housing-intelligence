import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportFiles,inventory,publishedPlaces} from './lib/publication.mjs';

const web=fileURLToPath(new URL('../',import.meta.url));
const root=path.resolve(web,process.env.PUBLICATION_ROOT??'out');
// Never inside out/: diagnostics, not public site assets.
const output=path.join(web,'.publication');
const registry=JSON.parse(await readFile(path.join(web,'lib/placeRoutes.json'),'utf8'));
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const places=publishedPlaces(registry,sitemap);
const report=inventory(await exportFiles(root),places);
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,byPlace:undefined},null,2));
