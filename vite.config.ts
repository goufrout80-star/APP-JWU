import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Admin app runs on its own port so it can run alongside the marketing
// site (5180). Deploys independently to app.justwhyus.com.
export default defineConfig({
  plugins: [react()],
  server: { port: 5181 },
})
