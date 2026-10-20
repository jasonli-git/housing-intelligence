import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseRedirects,publishedPlaces,legacyManifest,validateCoverage,inventory} from './lib/publication.mjs';
import {createLegacyRedirect} from './lib/legacy-resolver.mjs';

test('strict rules reject duplicate, dynamic, rewrite, external and unsafe targets',()=>{
 for(const text of ['/regions/1 / 301\n/regions/1 / 301','/regions/* / 301','/regions/1 / 200','/regions/1 https://evil.test 301','/regions/1 //evil/path 301','/regions/1 /../x 301'])assert.throws(()=>parseRedirects(text));
 assert.equal(parseRedirects('/regions/1 / 301').size,1);
});
test('only sitemap places; local targets checked against pinned registry',()=>{
 const registry={2:{state:'nj',slug:'town',level:'municipality'},3:{state:'nj',slug:'retained',level:'zip'}};
 const places=publishedPlaces(registry,'<loc>https://test.example/nj/town</loc>');assert.equal(places.length,1);
 assert.throws(()=>legacyManifest(places,parseRedirects('/regions/2 /nj/wrong 301')));
 assert.deepEqual(legacyManifest(places,new Map()).map(e=>e.coverage),['alias','alias']);
});
test('coverage rejects both, neither, wrong alias and missing targets',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'hip-publication-test-'));
 try {
  await mkdir(path.join(root,'nj'),{recursive:true});await mkdir(path.join(root,'regions'),{recursive:true});
  await writeFile(path.join(root,'nj/town.html'),'canonical');await writeFile(path.join(root,'_redirects'),'/regions/2 /nj/town 301\n');
  const entries=[{from:'/regions/2',to:'/nj/town',coverage:'rule'}];await validateCoverage(root,entries);
  await writeFile(path.join(root,'regions/2.html'),'duplicate');await assert.rejects(validateCoverage(root,entries),/exactly one/);
  await writeFile(path.join(root,'_redirects'),'');await assert.rejects(validateCoverage(root,entries),/Wrong alias/);
  await writeFile(path.join(root,'regions/2.html'),'location.replace("/nj/town"+location.search+location.hash) url=/nj/town');await validateCoverage(root,entries);
  await rm(path.join(root,'regions/2.html'));await assert.rejects(validateCoverage(root,entries),/exactly one/);
  await rm(path.join(root,'nj/town.html'));await assert.rejects(validateCoverage(root,entries),/Missing redirect target/);
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
test('per-place attribution excludes adjacent slugs and includes nested report payloads',()=>{
 const report=inventory([{path:'nj/town.html',bytes:10},{path:'nj/town.txt',bytes:2},{path:'nj/town/report.html',bytes:20},{path:'nj/township.html',bytes:50},{path:'regions/2/report.html',bytes:1}], [{id:'2',route:'/nj/town',level:'municipality'}],[{from:'/regions/2/report',coverage:'alias'}],1);
 assert.equal(report.byPlace[0].files,3);assert.equal(report.byPlace[0].aliases,1);assert.equal(report.files,5);
});
