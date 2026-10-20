// Shared by the local-only Worker and Pages Function candidates. Exact allowlist:
// no guessing unknown ids, redirecting API/download paths, or accepting open targets.
export function createLegacyRedirect(entries) {
  const paths=new Map(entries.map(({from,to})=>[from,to]));
  return request=>{
    const url=new URL(request.url),target=paths.get(url.pathname);
    if(!target)return null;
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    url.pathname=target;
    // URL.search is untouched; fragments are inherited by the browser, never sent
    // to the server. No new fragment is specified in Location.
    return new Response(null,{status:301,headers:{Location:url.href}});
  };
}
