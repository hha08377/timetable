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