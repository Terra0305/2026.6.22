import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.css':'text/css; charset=utf-8' };

http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    let filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) throw new Error('Invalid path');
    const info = await stat(filePath).catch(() => null);
    if ((info && info.isDirectory()) || pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control':'no-store, no-cache, must-revalidate', 'Pragma':'no-cache', 'Expires':'0' });
    response.end(body);
  } catch (_) {
    response.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, () => {
  console.log(`AquaGuard demo: http://localhost:${port}`);
  console.log(`Simulator: http://localhost:${port}/simulator`);
  console.log(`Main app:  http://localhost:${port}/`);
});
