import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The SkillPath API (uvicorn app.main:app) runs on port 8000. Vite forwards
// /api calls to it, so the browser only ever talks to one origin and the
// backend needs no CORS setup. Set SKILLPATH_API to use another address.
const api = { '/api': process.env.SKILLPATH_API ?? 'http://127.0.0.1:8000' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: api },
  preview: { port: 5173, proxy: api },
  // MUI makes one ~600 KB chunk (190 KB gzipped); fine for a local app
  build: { chunkSizeWarningLimit: 800 },
})
