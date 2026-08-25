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
  if (url.pathname === '/api/admin/control-center') return json(response, 200, { service:{mode:'operational',computedMode:'degraded',message:''}, metrics:{activeUsers:12,bikes:{total:50,available:31,inUse:8,maintenance:6,unavailable:5},stations:{normal:6,weak:2,full:1,closed:1},activeRides:8,openIncidents:3,overdueMaintenance:2,criticalTickets:1,overdueMissions:2,offlineDevices:1}, attention:[{type:'mission_overdue',severity:'critical',resource_id:4,title:'Mission en retard',message:'MIS-0004 · Rééquilibrage centre'}], configuration:{database:'operational',email:'missing',payment:'missing',devices:'degraded'}, generatedAt:new Date().toISOString() });
  if (/^\/api\/admin\/control-center\/[a-z-]+$/.test(url.pathname)) return json(response, 200, { items:[], pagination:{page:1,limit:25,total:0,pages:1} });
  if (url.pathname === '/api/admin/settings') return json(response, 200, { settings:[] });
  if (url.pathname === '/api/admin/plans') return json(response, 200, { plans:[], pagination:{page:1,limit:25,total:0,pages:1} });
  if (url.pathname.startsWith('/api/admin/')) return json(response, 200, { items:[], pagination:{page:1,limit:25,total:0,pages:1} });
  if (url.pathname === '/api/login' && request.method === 'POST') { response.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Set-Cookie':'__Host-pikala_session=test-control-session; Path=/; HttpOnly; SameSite=Lax' }); response.end(JSON.stringify({ user })); return; }
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
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mjs': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8' }[extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch {
    json(response, 404, { error: 'Not found' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Pikala test server: http://127.0.0.1:${port}`));
