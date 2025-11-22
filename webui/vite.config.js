import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../dist/webui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true
      }
    }
  }
});

