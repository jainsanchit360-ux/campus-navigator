import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()  // Enables HTTPS for mobile GPS access
  ],
  server: {
    https: true,
    host: true,   // expose on all network interfaces (same as --host)
    port: 5173,
  }
})
