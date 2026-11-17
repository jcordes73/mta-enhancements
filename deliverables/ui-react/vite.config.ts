import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev proxy → the Quarkus hub-backend (no CORS config needed on the backend)
      '/api': {
        target: process.env.HUB_API || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, ''),
      },
    },
  },
})
