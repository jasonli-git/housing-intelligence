// Old numeric addresses (ARCHITECTURE #367, #400, #454). Exact allowlist: no guessing
// unknown ids, redirecting API/download paths, or accepting open targets.
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

// Workers static assets answer every request that matches a file without running this
// script, so it only sees addresses with no file: an old numeric one, or a 404.
export function createHandler(entries) {
  const redirect=createLegacyRedirect(entries);
  return {fetch(request,env){return redirect(request)??env.ASSETS.fetch(request);}};
}
