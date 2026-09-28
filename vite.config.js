import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api.js'

export default defineConfig(({ mode }) => ({
  plugins: [react(), { name:'transitx-private-api', configureServer(server) { server.middlewares.use(createApi({...loadEnv(mode,process.cwd(),''),...process.env})) } }],
  build: {
    rollupOptions: {
      output: { manualChunks: { motion: ['framer-motion'] } },
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return
        warn(warning)
      },
    },
  },
}))
