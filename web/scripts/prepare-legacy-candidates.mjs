import {mkdir,mkdtemp,readFile,writeFile,link,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportFiles} from './lib/publication.mjs';

// Disposable local emulator tree. Not web/functions/, web/public/ or dist/site/:
// make deploy cannot activate this candidate. Hard links avoid duplicating 3 GB.
const web=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(web,'.publication');
const root=path.resolve(web,process.env.PUBLICATION_ROOT??'out');
const manifest=JSON.parse(await readFile(path.join(output,'legacy-redirects.json'),'utf8'));
const candidate=await mkdtemp(path.join(output,'candidate-'));
const site=path.join(candidate,'site');await mkdir(site);
for(const file of await exportFiles(root)) {
 if(file.path.startsWith('regions/')||file.path==='_redirects')continue;
 const target=path.join(site,file.path);await mkdir(path.dirname(target),{recursive:true});await link(path.join(root,file.path),target);
}
await copyFile(path.join(output,'pages/_routes.json'),path.join(site,'_routes.json'));
await mkdir(path.join(candidate,'functions/regions'),{recursive:true});
await copyFile(path.join(output,'pages/functions/regions/[[path]].js'),path.join(candidate,'functions/regions/[[path]].js'));
await writeFile(path.join(output,'candidate-paths.json'),JSON.stringify({candidate,site,entries:manifest.entries.length})+'\n');
console.log(`LOCAL ONLY: cd ${candidate} && wrangler pages dev site --port 3007 --ip 127.0.0.1 --compatibility-date=2026-09-03`);
