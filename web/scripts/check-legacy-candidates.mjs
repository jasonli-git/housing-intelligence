import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const output=new URL('../.publication/',import.meta.url);
const {origin,entries}=JSON.parse(await readFile(new URL('legacy-redirects.json',output),'utf8'));
const csv=(await readFile(new URL('bulk-redirects.csv',output),'utf8')).trim().split('\n');
const worker=(await import(new URL('worker/index.js',output))).default;
const {onRequest}=await import(new URL('pages/functions/regions/[[path]].js',output));
// Check every generated CSV row against the manifest, including parameter order.
assert.equal(csv.length,entries.length);
for(const [i,e] of entries.entries()) {
 assert.equal(csv[i],`${new URL(origin).host}${e.from},${origin}${e.to},301,TRUE,FALSE,FALSE,FALSE`);
 for(const method of ['GET','HEAD']) {
  const request=new Request(`https://local.test${e.from}?keep=1&keep=2`,{method});
  for(const response of [await worker.fetch(request),await onRequest({request,next:()=>{throw Error('unexpected passthrough');}})]) {
   assert.equal(response.status,301);assert.equal(response.headers.get('Location'),`https://local.test${e.to}?keep=1&keep=2`);
  }
 }
}
const passthrough=new Request('https://local.test/regions/12/metrics.json');
assert.equal(await (await onRequest({request:passthrough,next:()=>new Response('pass')})).text(),'pass');
const originalFetch=globalThis.fetch;
try {globalThis.fetch=async request=>new Response(request.url);assert.equal(await (await worker.fetch(passthrough)).text(),passthrough.url);}finally{globalThis.fetch=originalFetch;}

// Real Pages runtime on the disposable candidate tree, without _redirects/aliases.
const runtime=process.env.CANDIDATE_ORIGIN??'http://127.0.0.1:3007';
for(const route of ['/regions/224','/regions/12/report','/regions/3283/report','/regions/1','/regions/16828/report']) {
 const expected=entries.find(e=>e.from===route);assert(expected);
 const response=await fetch(`${runtime}${route}?keep=1`,{redirect:'manual'});assert.equal(response.status,301);
 assert.equal(response.headers.get('location'),`${runtime}${expected.to}?keep=1`);
}
assert.equal((await fetch(`${runtime}/regions/999999999`)).status,404);
assert.equal((await fetch(`${runtime}/regions/12/metrics.json`)).status,404);
const browser=await chromium.launch();
try {
 for(const javaScriptEnabled of [false,true]) {
  const context=await browser.newContext({javaScriptEnabled});const page=await context.newPage();
  await page.goto(`${runtime}/regions/3283/report?keep=1#sources`);await page.waitForURL(`${runtime}/nj/zip-07030/report?keep=1#sources`);
  assert((await page.locator('h1').first().textContent()).includes('07030'));await context.close();
 }
}finally{await browser.close();}
console.log(`PASS: ${entries.length} CSV rows and both code candidates (GET/HEAD), exact passthrough; Pages runtime and JS/no-JS query/fragment/report navigation`);
