import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// CSP only in production builds: the dev server injects inline styles/scripts for HMR.
// GitHub Pages can't send headers, so it goes in a <meta> tag.
function csp(supabaseUrl) {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // driver.js and Vue set inline styles
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    `connect-src ${supabaseUrl}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: () => {
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required to build')
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    base: './',
    plugins: [vue(), csp(env.VITE_SUPABASE_URL)],
  }
})
