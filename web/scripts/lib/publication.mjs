import {readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Workers static assets on Workers Paid (ARCHITECTURE #454). Warn well before the cap,
// so a second state's build says so before a deploy refuses it.
export const FILE_CAP=100000;
export const FILE_WARN=80000;

const LEGACY=/^\/regions\/[1-9]\d*(?:\/report)?$/;
const TARGET=/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

// The few old addresses that are not places (the state and the nation), written by hand.
// Refuse anything but an exact local path, as the Worker trusts this list.
export function fixedRoutes(json) {
  return Object.entries(json).map(([from,to])=>{
    if(!LEGACY.test(from)||!TARGET.test(to))throw new Error(`Unsupported legacy route: ${from} ${to}`);
    return {from,to};
  });
}

export function publishedPlaces(registry,sitemap) {
  const locations=new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname));
  return Object.entries(registry).flatMap(([id,r])=>{
    if(!/^[1-9]\d*$/.test(id)||!/^[a-z]{2}$/.test(r.state)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug))throw new Error(`Invalid route registry entry: ${id}`);
    const route=`/${r.state}/${r.slug}`;
    return locations.has(route)?[{id,route,level:r.level}]:[];
  });
}

// Every published place's page and report, ZIPs included, plus the fixed routes.
export function legacyManifest(places,fixed) {
  const entries=new Map();
  for(const place of places)for(const suffix of ['', '/report']) {
    const from=`/regions/${place.id}${suffix}`;
    entries.set(from,{from,to:`${place.route}${suffix}`});
  }
  for(const route of fixed) {
    if(entries.has(route.from))throw new Error(`Fixed route shadows a place: ${route.from}`);
    entries.set(route.from,route);
  }
  return [...entries.values()].sort((a,b)=>a.from.localeCompare(b.from,'en'));
}

export function htmlFile(route) {return route==='/'?'index.html':`${route.slice(1)}.html`;}
export async function exists(file) {try{return (await stat(file)).isFile();}catch(e){if(e.code==='ENOENT')return false;throw e;}}

// A file at an old address would be served before the Worker runs and shadow its
// redirect, so none may exist; every target must.
export async function validateManifest(root,entries) {
  if(root instanceof URL)root=fileURLToPath(root);
  for(const entry of entries) {
    if(!await exists(path.join(root,htmlFile(entry.to))))throw new Error(`Missing redirect target: ${entry.to}`);
  }
  for(const name of ['regions','regions.html','_redirects']) {
    try{await stat(path.join(root,name));}catch(e){if(e.code==='ENOENT')continue;throw e;}
    throw new Error(`${name} in the export would shadow the Worker's redirects`);
  }
}

export async function exportFiles(root) {
  if(root instanceof URL)root=fileURLToPath(root);
  const names=(await readdir(root,{recursive:true,withFileTypes:true})).filter(f=>f.isFile());
  return Promise.all(names.map(async f=>{const absolute=path.join(f.parentPath,f.name);return {path:path.relative(root,absolute).split(path.sep).join('/'),bytes:(await stat(absolute)).size};}));
}

export function inventory(files,places) {
  const groups={},cohorts={};
  for(const file of files) {
    const group=file.path.startsWith('_next/')?'shared Next assets':file.path.endsWith('.html')?'canonical HTML':file.path.endsWith('.txt')?'RSC payloads':file.path.endsWith('.json')?'JSON':'other';
    const g=groups[group]??={files:0,bytes:0};g.files++;g.bytes+=file.bytes;
  }
  const byPlace=places.map(place=>{
    const prefix=place.route.slice(1);
    const owned=files.filter(f=>f.path===`${prefix}.html`||f.path===`${prefix}.txt`||f.path.startsWith(`${prefix}.segments/`)||f.path.startsWith(`${prefix}/`));
    const row={...place,files:owned.length,bytes:owned.reduce((n,f)=>n+f.bytes,0)};
    const c=cohorts[place.level]??={places:0,files:0,bytes:0};c.places++;c.files+=row.files;c.bytes+=row.bytes;
    return row;
  });
  return {files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),headroom:{files:FILE_CAP-files.length},groups,cohorts,byPlace};
}
