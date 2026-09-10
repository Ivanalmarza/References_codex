import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Relative base so the built assets work no matter where the axet SPA node
  // mounts the app (behind a proxy / sub-path). Defaults to "./".
  const base = env.VITE_BASE_URL || './'

  // In development we proxy the Node-RED endpoints so the SPA can always call
  // relative paths (/api, /_auth) exactly like it will in production.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:1880'

  return {
    base,
    plugins: [vue(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // Docker Desktop bind mounts do not always forward filesystem events.
      // Polling keeps HMR working when the source lives on the host machine.
      watch: { usePolling: true, interval: 100 },
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/_auth': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
