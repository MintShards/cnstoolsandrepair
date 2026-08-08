/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Override when the backend runs on a non-default port (e.g. a second dev session)
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      }
    }
  }
})
