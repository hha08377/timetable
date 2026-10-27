import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 手机调试时会用到 host: true（让同一 WiFi 下的手机能访问）
// 以后要部署到 GitHub Pages，这里还需要加一行 base: '/仓库名/'
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
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
})