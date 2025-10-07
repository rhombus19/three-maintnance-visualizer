import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  
  base: '/3dviewer/',
  build: {
    outDir: path.resolve(__dirname, '../wwwroot/3dviewer'),
    emptyOutDir: true
  },
  server: { port: 5173, strictPort: true }
});
