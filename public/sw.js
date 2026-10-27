// Service Worker：让页面在断网时也能打开（只缓存"壳"，数据本来就在 localStorage）
// 策略：网络优先 → 失败回落到缓存。改版本号（CACHE）可以强制换新。
const CACHE = 'kxb-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html'))),
  )
})