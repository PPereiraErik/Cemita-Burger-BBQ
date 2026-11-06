import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin } from './seo.plugin'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seoPlugin(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL)],
  build: {
    target: 'es2020',
    rollupOptions: {
      // duas páginas: o site (index.html) e o painel da equipe (admin/index.html → /admin/)
      input: {
        site: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
      output: {
        manualChunks: { gsap: ['gsap', 'gsap/ScrollTrigger', '@gsap/react'] },
      },
    },
  },
}))
