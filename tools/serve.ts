// Static server for the browser build: node tools/serve.ts [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || 8823);
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', 
  '.css': 'text/css', '.json': 'application/json',
};
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  if (p === '/') {
    res.writeHead(302, { location: '/web/index.html' }).end();
    return;
  }
  const file = normalize(join(root, p));
  if (!file.startsWith(root) || !(file.includes('/web/'))) {
    res.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
