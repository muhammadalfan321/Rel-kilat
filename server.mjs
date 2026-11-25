import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawEnvPort = process.env.APP_PORT || (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '');
const PORT = Number(rawEnvPort) || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DIST_DIR = path.resolve(__dirname, 'dist');
const GAME_HTML_PATH = path.resolve(
  PUBLIC_DIR,
  'assets/aistudio/rel-kilat-lengkap_ab50420c.html',
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function resolveSafeFile(baseDir, reqPath) {
  const cleanPath = reqPath.replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, cleanPath);
  if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  let pathname = '/';
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (pathname === '/health') {
    const body = '{"ok":true}';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
    return;
  }

  let targetPath = null;
  if (pathname === '/' || pathname === '/index.html') {
    const distIndex = path.join(DIST_DIR, 'index.html');
    targetPath =
      process.env.NODE_ENV === 'production' && fs.existsSync(distIndex)
        ? distIndex
        : GAME_HTML_PATH;
  } else {
    const candidatePublic = resolveSafeFile(PUBLIC_DIR, pathname);
    const candidateDist = resolveSafeFile(DIST_DIR, pathname);
    if (candidatePublic && fs.existsSync(candidatePublic) && fs.statSync(candidatePublic).isFile()) {
      targetPath = candidatePublic;
    } else if (
      candidateDist &&
      fs.existsSync(candidateDist) &&
      fs.statSync(candidateDist).isFile()
    ) {
      targetPath = candidateDist;
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const stat = fs.statSync(targetPath);
  const ext = path.extname(targetPath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(targetPath).pipe(res);
});

server.on('error', (err) => {
  console.error('Rel Kilat server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Rel Kilat server listening on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
