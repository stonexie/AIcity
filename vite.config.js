import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'assets',
  server: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true },
  build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
