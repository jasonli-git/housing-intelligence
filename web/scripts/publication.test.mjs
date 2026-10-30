import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fixedRoutes,publishedPlaces,legacyManifest,validateManifest,inventory} from './lib/publication.mjs';
import {createLegacyRedirect,createHandler} from '../worker/legacy.mjs';

test('fixed routes reject wildcards, external and unsafe targets',()=>{
 for(const [from,to] of [['/regions/*','/'],['/regions/1','https://evil.test'],['/regions/1','//evil/path'],['/regions/1','/../x'],['/regions/01','/'],['/other','/']])assert.throws(()=>fixedRoutes({[from]:to}));
 assert.deepEqual(fixedRoutes({'/regions/1':'/states/new-jersey'}),[{from:'/regions/1',to:'/states/new-jersey'}]);
});
test('only sitemap places; every page and report, ZIPs included; fixed routes cannot shadow a place',()=>{
 const registry={2:{state:'nj',slug:'town',level:'municipality'},3:{state:'nj',slug:'zip-07030',level:'zip'},4:{state:'nj',slug:'gone',level:'zip'}};
 const places=publishedPlaces(registry,'<loc>https://test.example/nj/town</loc><loc>https://test.example/nj/zip-07030</loc>');
 assert.equal(places.length,2);
 assert.deepEqual(legacyManifest(places,[{from:'/regions/1',to:'/'}]).map(e=>`${e.from} ${e.to}`),
  ['/regions/1 /','/regions/2 /nj/town','/regions/2/report /nj/town/report','/regions/3 /nj/zip-07030','/regions/3/report /nj/zip-07030/report']);
 assert.throws(()=>legacyManifest(places,[{from:'/regions/2',to:'/'}]),/shadows/);
});
test('validation needs every target and refuses files that would shadow the Worker',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'hip-publication-test-'));
 try {
  await mkdir(path.join(root,'nj'),{recursive:true});await writeFile(path.join(root,'nj/town.html'),'canonical');
  const entries=[{from:'/regions/2',to:'/nj/town'}];await validateManifest(root,entries);
  for(const name of ['_redirects','regions.html']) {
   await writeFile(path.join(root,name),'');await assert.rejects(validateManifest(root,entries),/shadow/);await rm(path.join(root,name));
  }
  await mkdir(path.join(root,'regions'));await assert.rejects(validateManifest(root,entries),/shadow/);await rm(path.join(root,'regions'),{recursive:true});
  await rm(path.join(root,'nj/town.html'));await assert.rejects(validateManifest(root,entries),/Missing redirect target/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('runtime exact allowlist preserves queries; unknown and artifact paths pass through',async()=>{
 const redirect=createLegacyRedirect([{from:'/regions/2',to:'/nj/town'},{from:'/regions/2/report',to:'/nj/town/report'}]);
 for(const method of ['GET','HEAD']) {
  const response=redirect(new Request('https://housing.test/regions/2/report?x=1&x=2',{method}));
  assert.equal(response.status,301);assert.equal(response.headers.get('Location'),'https://housing.test/nj/town/report?x=1&x=2');assert.equal(await response.text(),'');
 }
 for(const suffix of ['/3','/02','/2/metrics.json','/2/','/2/report/extra'])assert.equal(redirect(new Request(`https://housing.test/regions${suffix}`)),null);
 assert.equal(redirect(new Request('https://housing.test/regions/2',{method:'POST'})).status,405);
});
test('the Worker hands everything it does not redirect to the static assets',async()=>{
 const worker=createHandler([{from:'/regions/2',to:'/nj/town'}]);
 const env={ASSETS:{fetch:request=>new Response(`asset ${new URL(request.url).pathname}`,{status:404})}};
 assert.equal((await worker.fetch(new Request('https://housing.test/regions/2'),env)).status,301);
 const passed=await worker.fetch(new Request('https://housing.test/regions/999'),env);
 assert.equal(passed.status,404);assert.equal(await passed.text(),'asset /regions/999');
});
test('per-place attribution excludes adjacent slugs and includes nested report payloads',()=>{
 const report=inventory([{path:'nj/town.html',bytes:10},{path:'nj/town.txt',bytes:2},{path:'nj/town/report.html',bytes:20},{path:'nj/township.html',bytes:50}],[{id:'2',route:'/nj/town',level:'municipality'}]);
 assert.equal(report.byPlace[0].files,3);assert.equal(report.files,4);assert.equal(report.headroom.files,99996);
});
