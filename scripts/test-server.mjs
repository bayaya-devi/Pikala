import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('sitepikala');
const port = Number(process.env.PORT || 8788);
const stations = [
  { id: 1, name: 'Kasbah des Oudayas', address: 'Rabat', bikes_available: 8, latitude: 34.0318, longitude: -6.8361 },
  { id: 2, name: 'Tour Hassan', address: 'Rabat', bikes_available: 3, latitude: 34.0241, longitude: -6.8227 },
  { id: 3, name: 'Jardin d’Essais', address: 'Agdal', bikes_available: 12, latitude: 34.0127, longitude: -6.8478 }
];
const user = { id: 1, first_name: 'Test', last_name: 'Pikala', email: 'test@pikala.local', phone: '+212600000000', role: 'admin' };

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/me') return json(response, 200, { user });
  if (url.pathname === '/api/stations') return json(response, 200, { stations });
  if (url.pathname === '/api/profile') return json(response, 200, { user, subscription: { plan: 'Premium', status: 'active' } });
  if (url.pathname.startsWith('/api/')) return json(response, 200, { ok: true, user, message: 'Action de test réussie.' });

  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = resolve(root, requested);
  if (file !== root && !file.startsWith(`${root}${sep}`)) return json(response, 403, { error: 'Forbidden' });
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png' }[extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch {
    json(response, 404, { error: 'Not found' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Pikala test server: http://127.0.0.1:${port}`));
