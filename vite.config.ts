/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The corpus site: one page, no router. Built to dist/ and served by Firebase Hosting.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { exclude: ['**/node_modules/**', '.claude/**', 'dist/**'] },
})
