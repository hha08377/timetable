import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 手机调试时会用到 host: true（让同一 WiFi 下的手机能访问）
// 以后要部署到 GitHub Pages，这里还需要加一行 base: '/仓库名/'
export default defineConfig({
  // GitHub Pages 是「项目页」，站点挂在 /仓库名/ 下，构建时必须带这个前缀。
  // 平时 `npm run dev` 还是根路径 '/'，两边互不影响。
  base: process.env.GH_PAGES ? '/timetable/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // 允许通过隧道域名访问（Vite 默认只认 localhost/IP，别的 Host 头一律 403）
    allowedHosts: ['.lhr.life', '.trycloudflare.com', '.ngrok-free.app'],
    watch: {
      // 有些编辑器保存文件时会先写一个临时目录再改名，Vite 去监听它会报 EBUSY 直接崩掉。
      // 下面这几条把临时文件、构建产物、依赖目录都排除掉（默认的 node_modules/.git 要手写回来）。
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.*.tmpdir/**',
        '**/.*.tmp',
      ],
    },
  },
  // vite preview（跑构建产物，模拟线上）同样需要放行隧道域名
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.lhr.life', '.trycloudflare.com', '.ngrok-free.app'],
  },
})