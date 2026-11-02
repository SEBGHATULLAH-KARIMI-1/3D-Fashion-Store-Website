import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built site works on GitHub Pages (/<repo-name>/) and locally.
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // React in its own file: cached by the browser between deploys.
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
