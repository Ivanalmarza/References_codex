import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim()
  const proxy: Record<string, string | ProxyOptions> | undefined = proxyTarget
    ? {
        '/_auth': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (requestPath) => `/references-codex${requestPath}`,
        },
      }
    : undefined

  return {
    // Required by the axet-spa-app embedded deployment. Generated asset URLs stay relative.
    base: './',
    plugins: [vue(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy,
      watch: { usePolling: true, interval: 100 },
    },
  }
})
