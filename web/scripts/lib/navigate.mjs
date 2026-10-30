import http from 'node:http';
import https from 'node:https';

// A browser navigation over node:http, not fetch: fetch overwrites Sec-Fetch-Mode with
// `cors`, and Workers routes on that header (ARCHITECTURE #454). No redirect is followed.
const HEADERS={accept:'text/html','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};

export function navigate(url,{timeout=20_000}={}){
 const client=new URL(url).protocol==='https:'?https:http;
 return new Promise((resolve,reject)=>{
  const request=client.get(url,{headers:HEADERS,timeout},response=>{
   const chunks=[];
   response.on('data',chunk=>chunks.push(chunk));
   response.on('error',reject);
   response.on('end',()=>resolve({status:response.statusCode,location:response.headers.location??null,text:Buffer.concat(chunks).toString('utf8')}));
  });
  request.on('timeout',()=>request.destroy(new Error(`${url} timed out`)));
  request.on('error',reject);
 });
}
