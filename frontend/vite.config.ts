import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        // Vendor libraries in their own long-cacheable chunks, each loaded only by the pages that use it.
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules[\/]three[\/]/, priority: 40 },
            { name: 'vendor-r3f', test: /node_modules[\/](@react-three|three-stdlib|troika-|maath|camera-controls|meshline|@monogrid|stats-gl|suspend-react|its-fine|zustand)/, priority: 30 },
            { name: 'vendor-recharts', test: /node_modules[\/](recharts|d3-|victory-vendor|internmap|decimal\.js-light|@reduxjs|redux|immer|reselect|es-toolkit|eventemitter3|react-redux|use-sync-external-store)/, priority: 20 },
            { name: 'vendor-motion', test: /node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/, priority: 20 },
            { name: 'vendor-react', test: /node_modules[\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\/]/, priority: 10 },
          ],
        },
      },
    },
    // three.js core alone is ~680 kB minified and cannot be split further; it loads only with the 3D views.
    chunkSizeWarningLimit: 700,
  },
})
