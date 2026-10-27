// 整个网页的入口：把 <App /> 挂到 index.html 里那个 id="root" 的 div 上
// 你以后 90% 的时间只会改 App.jsx，这个文件基本不用动
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// —— 离线缓存（只在上线后的 https 环境生效）——
// 为什么要卡 https：Service Worker 在 http（包括局域网 IP）下浏览器直接拒绝注册，
// 而且开发时开了缓存会让 HMR 改不动，所以只在正式站点注册。
if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // BASE_URL 是部署路径（GitHub Pages 子目录时是 '/timetable/'），不能写死 '/sw.js'
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {
      // 注册失败不影响使用，静默忽略
    })
  })
}