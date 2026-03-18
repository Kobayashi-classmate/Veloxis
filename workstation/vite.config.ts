import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy Directus requests to Nginx gateway
      '/hdjskefs45': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy Cube.js API requests to Nginx gateway
      '/cubejs-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
