import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Where Vite's dev proxy forwards /api and /admin requests.
// Override with BACKEND_URL=http://other-host:8000 if needed.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true },
      '/admin': { target: BACKEND_URL, changeOrigin: true },
    },
  },
})
