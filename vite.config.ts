import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: '.',
  // Relative base — bundle works at any subpath (e.g. e01.ai/consensus/) or root.
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
})
