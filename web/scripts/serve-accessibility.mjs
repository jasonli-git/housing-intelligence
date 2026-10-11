// Preview the actual static export, including extensionless production routes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('out');
const port = Number(process.env.A11Y_PORT ?? 3002);
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png', '.ico':'image/x-icon' };
createServer(async (request,response) => {
  try {
    const path = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    // Local guide preview only: adapt published JSON paths to the read-only API.
    // Production builds never point here unless the explicit preview override is set.
    if (path.startsWith('/preview-guide/')) {
      const match = path.match(/^\/preview-guide\/regions\/(\d+)\/(packet\/5y|metrics|income-limits|water-systems|community|utilities)\.json$/);
      if (!match || request.method !== 'GET') { response.writeHead(404).end(); return; }
      const endpoint = match[2] === 'packet/5y' ? 'packet?window=5y' : match[2];
      const result = await fetch(`http://localhost:8000/regions/${match[1]}/${endpoint}`);
      response.writeHead(result.status, { 'Content-Type': 'application/json' });
      response.end(await result.text()); return;
    }
    let file = resolve(root, `.${path}`);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (file === root) file = resolve(root,'index.html');
    else if (!extname(file)) file += '.html';
    await stat(file);
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Static accessibility preview: http://localhost:${port}`));
