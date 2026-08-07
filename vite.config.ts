import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router-dom|framer-motion)/ },
            { name: 'editor-vendor', test: /node_modules[\\/](@tiptap|prosemirror-)/ },
            { name: 'charts-vendor', test: /node_modules[\\/](recharts|d3-|victory-vendor)/ },
            { name: 'ml-vendor', test: /node_modules[\\/]@tensorflow/ },
          ],
        },
      },
    },
  },
})
