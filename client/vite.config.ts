import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // 使用相对路径，支持 Electron 打包
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  // 解决 PeerJS 在 Vite 开发环境下的兼容性问题
  define: {
    global: 'window',
  },
  resolve: {
    alias: {
      // 某些 Node 模块可能需要 polyfill
      util: 'util'
    }
  }
})
