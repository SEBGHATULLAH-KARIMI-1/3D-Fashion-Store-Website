import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built site works on GitHub Pages (/<repo-name>/) and locally.
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
})
