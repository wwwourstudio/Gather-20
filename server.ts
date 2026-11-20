import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import express from 'express';
import { createApiApp } from './server/app.js';
import { attachWebSocketHub } from './server/ws/roomHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  // All /api routes live in server/app.ts so Vercel can serve the same handlers.
  const app = createApiApp();

  const server = http.createServer(app);
  attachWebSocketHub(server);

  // Vite or Static Hosting
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // Vite 8 injects /@vite/client and invokes transport.connect() even when hmr/ws are false,
    // which causes an unhandled WebSocket rejection behind single-port reverse proxies.
    app.use('/@vite/client', (_req, res, next) => {
      const origEnd = res.end.bind(res);
      const chunks: Buffer[] = [];
      let intercepted = false;

      res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
        intercepted = true;
        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(String(chunk), (encoding as BufferEncoding) || 'utf8')
          );
        }
        if (typeof encoding === 'function') encoding();
        else if (typeof cb === 'function') cb();
        return true;
      }) as typeof res.write;

      res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
        if (!intercepted && !chunk) {
          return origEnd(chunk as never, encoding as never, cb as never);
        }
        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(String(chunk), (encoding as BufferEncoding) || 'utf8')
          );
        }
        let body = Buffer.concat(chunks).toString('utf8');
        body = body.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* HMR disabled */'
        );
        res.removeHeader('Content-Length');
        res.setHeader('Content-Type', 'application/javascript');
        return origEnd(
          body,
          'utf8',
          typeof encoding === 'function'
            ? (encoding as () => void)
            : (cb as (() => void) | undefined)
        );
      }) as typeof res.end;

      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`gather studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start gather server:', err);
  process.exit(1);
});
