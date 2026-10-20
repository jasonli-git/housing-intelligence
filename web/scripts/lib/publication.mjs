import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Intentionally exact/static only. Refuse new rule syntax rather than silently
// treating a wildcard, rewrite, external target or duplicate as equivalent coverage.
export function parseRedirects(text) {
  const rules=new Map();
  for(const line of text.split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'))) {
    const parts=line.split(/\s+/),[from,to,status]=parts;
    if(parts.length!==3||!/^\/regions\/[1-9]\d*(?:\/report)?$/.test(from)||!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/.test(to)||status!=='301')throw new Error(`Unsupported legacy rule: ${line}`);
    if(rules.has(from))throw new Error(`Duplicate legacy rule: ${from}`);
    rules.set(from,{from,to,status:301});
  }
  if(rules.size>2000)throw new Error('Pages static redirect limit exceeded');
  return rules;
}

export function publishedPlaces(registry,sitemap) {
  const locations=new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname));
  return Object.entries(registry).flatMap(([id,r])=>{
    if(!/^[1-9]\d*$/.test(id)||!/^[a-z]{2}$/.test(r.state)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug))throw new Error(`Invalid route registry entry: ${id}`);
    const route=`/${r.state}/${r.slug}`;
    return locations.has(route)?[{id,route,level:r.level}]:[];
  });
}

export function legacyManifest(places,rules) {
  const entries=new Map();
  for(const place of places)for(const suffix of ['', '/report']) {
    const from=`/regions/${place.id}${suffix}`,to=`${place.route}${suffix}`;
    const rule=rules.get(from);
    if(rule&&rule.to!==to)throw new Error(`Wrong redirect target: ${from}`);
    entries.set(from,{from,to,status:301,coverage:rule?'rule':'alias'});
  }
  // Nation/state destinations are not place-registry entries, but must survive too.
  for(const [from,rule] of rules)if(!entries.has(from))entries.set(from,{...rule,coverage:'rule'});
  return [...entries.values()].sort((a,b)=>a.from.localeCompare(b.from,'en'));
}

export function htmlFile(route) {return route==='/'?'index.html':`${route.slice(1)}.html`;}
export async function exists(file) {try{return (await stat(file)).isFile();}catch(e){if(e.code==='ENOENT')return false;throw e;}}

export async function validateCoverage(root,entries) {
  if(root instanceof URL)root=fileURLToPath(root);
  const rules=parseRedirects(await readFile(path.join(root,'_redirects'),'utf8'));
  for(const entry of entries) {
    if(!await exists(path.join(root,htmlFile(entry.to))))throw new Error(`Missing redirect target: ${entry.to}`);
    const rule=rules.get(entry.from),alias=await exists(path.join(root,htmlFile(entry.from)));
    if(Number(Boolean(rule))+Number(alias)!==1)throw new Error(`Expected exactly one rule or alias: ${entry.from}`);
    if(rule&&rule.to!==entry.to)throw new Error(`Wrong redirect target: ${entry.from}`);
    if(alias) {
      const text=await readFile(path.join(root,htmlFile(entry.from)),'utf8');
      if(!text.includes(`location.replace(${JSON.stringify(entry.to)}+location.search+location.hash)`)||!text.includes(`url=${entry.to}`))throw new Error(`Wrong alias target: ${entry.from}`);
    }
  }
}

export async function exportFiles(root) {
  if(root instanceof URL)root=fileURLToPath(root);
  const names=(await readdir(root,{recursive:true,withFileTypes:true})).filter(f=>f.isFile());
  return Promise.all(names.map(async f=>{const absolute=path.join(f.parentPath,f.name);return {path:path.relative(root,absolute).split(path.sep).join('/'),bytes:(await stat(absolute)).size};}));
}

export function inventory(files,places,entries,ruleCount) {
  const groups={},cohorts={};
  for(const file of files) {
    const group=file.path.startsWith('regions/')?'legacy aliases':file.path.startsWith('_next/')?'shared Next assets':file.path.endsWith('.html')?'canonical HTML':file.path.endsWith('.txt')?'RSC payloads':file.path.endsWith('.json')?'JSON':'other';
    const g=groups[group]??={files:0,bytes:0};g.files++;g.bytes+=file.bytes;
  }
  const byPlace=places.map(place=>{
    const prefix=place.route.slice(1);
    const owned=files.filter(f=>f.path===`${prefix}.html`||f.path===`${prefix}.txt`||f.path.startsWith(`${prefix}.segments/`)||f.path.startsWith(`${prefix}/`));
    const aliases=entries.filter(e=>e.from===`/regions/${place.id}`||e.from===`/regions/${place.id}/report`).filter(e=>e.coverage==='alias').length;
    const row={...place,files:owned.length,bytes:owned.reduce((n,f)=>n+f.bytes,0),aliases};
    const c=cohorts[place.level]??={places:0,files:0,bytes:0,aliases:0};c.places++;c.files+=row.files;c.bytes+=row.bytes;c.aliases+=aliases;
    return row;
  });
  return {files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),staticRedirects:ruleCount,headroom:{files:20000-files.length,staticRedirects:2000-ruleCount},groups,cohorts,byPlace};
}
