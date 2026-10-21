// Local Pages navigation and wire-cost probe. Does not intercept/delete payloads.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=process.env.EXPORT_CHECK_ORIGIN??'http://localhost:3002';
const output=process.env.EXPORT_CHECK_OUTPUT??'/tmp/hip-export-navigation.json';
const variant=process.env.EXPORT_CHECK_VARIANT??'baseline';
const browser=await chromium.launch();
const payload=url=>/\.segments\/|\.txt(?:[?#]|$)/.test(url)&&!url.includes('/robots.txt');
const cases=[
 {name:'place to parent county',from:'/nj/princeton',to:'/nj/mercer-county',title:'Mercer',
  act:page=>page.locator('a[href="/nj/mercer-county"]').first().click()},
 {name:'place to report',from:'/nj/princeton',to:'/nj/princeton/report',title:'Princeton',
  act:page=>page.locator('a.eyebrow-report').click()},
 {name:'report to place',from:'/nj/princeton/report',to:'/nj/princeton',title:'Princeton',
  act:page=>page.locator('a[href="/nj/princeton"]').first().click()},
 {name:'header buyer guide',from:'/nj/princeton',to:'/guide',title:'buying',
  act:async(page,width)=>{
   if(width===390)await page.locator('.bar-tool-menu summary').click();
   await page.locator(width===390?'.bar-tool-menu a[href="/guide"]':'.bar-desktop-tools a[href="/guide"]').click();
  }},
 {name:'header home',from:'/nj/princeton',to:'/',title:'Housing',
  act:page=>page.locator('nav .wordmark').click()},
 {name:'home search result',from:'/',to:'/nj/princeton',title:'Princeton',
  act:async page=>{
   await page.locator('main input[role="combobox"]').first().fill('Princeton');
   await page.getByRole('option').filter({hasText:/^Princeton/}).first().click();
  }},
 {name:'header search result',from:'/nj/princeton',to:'/nj/somerset-county',title:'Somerset',
  act:async page=>{
   await page.locator('nav input[role="combobox"]').fill('Somerset');
   await page.getByRole('option').filter({hasText:/Somerset/}).first().click();
  }},
];

function cost(requests){
 const local=requests.filter(r=>new URL(r.url).origin===new URL(origin).origin);
 const rsc=local.filter(r=>payload(r.url));
 return {requests:local.length,encodedTransferBytes:local.reduce((n,r)=>n+r.bytes,0),
  documentRequests:local.filter(r=>r.type==='Document').length,payloadRequests:rsc.length,
  payloadBytes:rsc.reduce((n,r)=>n+r.bytes,0),
  // Local workerd HTTP bytes, including response headers; not public-CDN timings.
  resourceTypes:Object.fromEntries([...new Set(local.map(r=>r.type))].map(t=>[t,local.filter(r=>r.type===t).length]))};
}

const results=[];
try{
 for(const width of [1280,390])for(const test of cases){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  const requests=new Map(),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.status()===404&&payload(response.url()))missing.push(response.url());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url,type:e.type,bytes:0}));
  cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r)r.bytes=e.encodedDataLength;});
  await page.goto(origin+test.from,{waitUntil:'networkidle'});
  await page.locator('main h1').first().waitFor();
  const initial=[...requests.values()];
  const sentinel=`${width}-${test.name}`;
  await page.evaluate(value=>window.__exportNavigationProbe=value,sentinel);
  requests.clear();
  await test.act(page,width);
  await page.waitForURL(origin+test.to);
  await page.waitForLoadState('networkidle');
  assert((await page.locator('main h1').first().innerText()).includes(test.title));
  const sameDocument=await page.evaluate(value=>window.__exportNavigationProbe===value,sentinel);
  const click=[...requests.values()];
  await page.goBack();await page.waitForURL(origin+test.from);
  await page.locator('main h1').first().waitFor();
  await page.goForward();await page.waitForURL(origin+test.to);
  const reload=await page.reload({waitUntil:'networkidle'});
  assert.equal(reload.status(),200);
  assert((await page.locator('main h1').first().innerText()).includes(test.title));
  assert.deepEqual(missing,[],'No payload/segment 404s, including history/reload');
  assert.deepEqual(errors,[],'No client page errors');
  const result={variant,width,journey:test.name,from:test.from,to:test.to,sameDocument,
   sourceLoadAndPrefetch:cost(initial),click:cost(click),backForwardReload:'passed',
   payload404s:missing,errors,
   payloadLog:[...initial,...click].filter(r=>payload(r.url))};
  results.push(result);
  console.log(`PASS ${variant} ${width} ${test.name}: ${sameDocument?'client transition':'full document'}, ${result.click.requests} requests / ${result.click.encodedTransferBytes} bytes after action`);
  await context.close();
 }
}finally{
 await browser.close();
 await writeFile(output,JSON.stringify({variant,origin,results},null,2)+'\n');
}
assert.equal(results.length,cases.length*2);
