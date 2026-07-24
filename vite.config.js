import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In-Memory Dev Server Room Store
const inMemoryRooms = new Map();

function housieRoomServerPlugin() {
  return {
    name: 'housie-room-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        if (url.startsWith('/api/housie-rooms')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'POST' || req.method === 'PUT') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (data && data.roomCode) {
                  const code = data.roomCode.toUpperCase();
                  inMemoryRooms.set(code, data);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, roomCode: code }));
                  return;
                }
              } catch (e) {
                console.error('Room plugin parse error:', e);
              }
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid room payload' }));
            });
            return;
          }

          if (req.method === 'GET') {
            const parts = url.split('/');
            const code = parts[parts.length - 1].toUpperCase();

            if (code && inMemoryRooms.has(code)) {
              res.statusCode = 200;
              res.end(JSON.stringify(inMemoryRooms.get(code)));
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Room not found in dev server memory' }));
            return;
          }
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), housieRoomServerPlugin()]
});
