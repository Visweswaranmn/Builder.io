import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the Express server in development so the browser
    // talks to a single origin and avoids CORS during local dev.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Local-disk upload fallback (see server/src/services/upload.service.ts)
      // returns relative /uploads/... URLs — proxy them too so <img>/<video>
      // tags resolve in dev when Cloudinary isn't configured.
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    // Vite 6 rejects unrecognized Host headers by default; Railway's proxy
    // forwards the public domain as the Host, so it must be allow-listed
    // for `vite preview` (used as the production server) to accept requests.
    allowedHosts: true,
  },
});
