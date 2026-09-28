/**
 * Measure X — Production Node.js Server
 * Zero external dependencies.
 * Features:
 * - Dynamic port resolution via process.env.PORT (Render, Heroku, Railway, etc.)
 * - Binds to 0.0.0.0 for local network testing and container deployments
 * - SPA Fallback (serves index.html for direct route navigation like /login, /dashboard)
 * - Built-in reverse proxy for /api/v1 if BACKEND_URL is specified
 * - Standard security & caching headers
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || null; // null enables dual-stack (both IPv4 0.0.0.0 and IPv6 :: for localhost)
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // Parse URL safely
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Set standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Reverse proxy for /api/ if BACKEND_URL is configured
  if (BACKEND_URL && pathname.startsWith('/api/')) {
    try {
      const targetUrl = new URL(pathname + parsedUrl.search, BACKEND_URL);
      const proxyReq = http.request(targetUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: targetUrl.host
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy Error]', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend Gateway Error', details: err.message }));
      });

      req.pipe(proxyReq);
      return;
    } catch (e) {
      console.error('[Proxy Exception]', e.message);
    }
  }

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path is a directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback: if file does not exist, serve index.html for client-side routing
  if (!fs.existsSync(filePath)) {
    // Only fallback for non-file requests (not .css, .js, etc.)
    if (!path.extname(pathname)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Caching headers
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stats.size });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

const listenArgs = HOST ? [PORT, HOST] : [PORT];
server.listen(...listenArgs, () => {
  const ips = getLocalIpAddresses();
  console.log('====================================================');
  console.log(`  🏛️  Measure X Server Running Successfully`);
  console.log('====================================================');
  console.log(`  - Local:    http://localhost:${PORT}`);
  console.log(`  - IPv4:     http://127.0.0.1:${PORT}`);
  for (const ip of ips) {
    console.log(`  - Network:  http://${ip}:${PORT}`);
  }
  console.log(`  - Host:     ${HOST || 'Dual-stack (IPv4 + IPv6)'}`);
  console.log(`  - Directory: ${PUBLIC_DIR}`);
  if (BACKEND_URL) {
    console.log(`  - API Proxy Target: ${BACKEND_URL}`);
  }
  console.log('====================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[MeasureX] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[MeasureX] SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
