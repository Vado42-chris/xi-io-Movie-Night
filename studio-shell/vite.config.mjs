import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  base: '/studio/',
  plugins: [react()],
  resolve: { alias: [
    { find: /^(?:@\/|\.\.\/)api\/base44Client(?:\.js)?$/, replacement: local('./host/studio-services.js') },
    { find: '@', replacement: local('./vendor/src') },
  ] },
  build: { outDir: '../studio-web', emptyOutDir: true, sourcemap: false },
});
