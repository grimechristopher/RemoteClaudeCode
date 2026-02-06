import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// NOTE: This is a temporary development server.
// TODO: Migrate Nuxt/H3 API handlers to Express for production

// For development, proxy API requests to Nuxt dev server
const NUXT_SERVER = process.env.NUXT_SERVER || 'http://localhost:3001';

// Middleware
app.use(express.json());

// Proxy API requests to Nuxt (temporary for dev/testing)
app.use('/api', createProxyMiddleware({
  target: NUXT_SERVER,
  changeOrigin: true,
  logLevel: 'warn',
}));

// Serve static frontend files
const frontendDist = join(__dirname, '../frontend-new/dist');
app.use(express.static(frontendDist));

// Serve index.html for all other routes (SPA fallback)
app.use((req, res) => {
  res.sendFile(join(frontendDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
  console.log(`Proxying /api requests to ${NUXT_SERVER}`);
  console.log('NOTE: Backend migration from Nuxt/H3 to Express is pending');
});
