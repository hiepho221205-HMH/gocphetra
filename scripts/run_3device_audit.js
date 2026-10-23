import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';

const DIST_DIR = path.resolve('dist');
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) ? filePath : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);
      const isAsset = reqPath.startsWith('/assets/');
      const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'no-cache';
      const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');
      const compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);

      if (acceptsGzip && compressible) {
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'text/plain',
          'Content-Encoding': 'gzip',
          'Cache-Control': cacheControl
        });
        fs.createReadStream(targetPath).pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': cacheControl
        });
        fs.createReadStream(targetPath).pipe(res);
      }
    });

    server.listen(port, () => resolve(server));
  });
}

async function main() {
  const server = await startServer(4173);
  console.log('[Runner] Server started on port 4173');

  const child = spawn('cmd.exe', ['/c', 'node', 'tests/e2e_3devices_realtime_audit.cjs'], {
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    console.log(`[Runner] 3-device audit exited with code ${code}`);
    server.close();
    process.exit(code);
  });
}

main().catch(console.error);
