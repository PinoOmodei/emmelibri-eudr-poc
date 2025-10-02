import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    exclude: ['xmllint-wasm'], // evita pre-bundling che rompe il worker
  },
  worker: {
    format: 'es', // importante per i web worker modulo
  }
})
