const CACHE_NAME = 'my-app-v2' // 更新版本号

self.addEventListener('install', (event) => {
  console.log('Service Worker 已安装')

  // 缓存页面
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./', './index.html'])
    })
  )
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活')

  // 清理旧缓存
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

self.addEventListener('fetch', (event) => {
  console.log('拦截到网络请求:', event.request.url)

  // 网络优先策略
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 网络请求成功，缓存响应
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // 网络失败，尝试从缓存获取
        console.log('网络失败，从缓存获取:', event.request.url)
        return caches.match(event.request)
      })
  )
})

self.addEventListener('push', (event) => {
  console.log('收到推送消息:', event.data ? event.data.text() : '无数据')

  const options = {
    body: event.data ? event.data.text() : '你有一条新消息',
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100]
  }

  event.waitUntil(
    self.registration.showNotification('Service Worker 通知', options)
  )
})

self.addEventListener('sync', (event) => {
  console.log('后台同步事件:', event.tag)

  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 这里可以执行需要在后台同步的任务
      console.log('执行后台同步任务')
    )
  }
})

self.addEventListener('message', (event) => {
  console.log('Service Worker 收到消息:', event.data)

  // 回复消息给页面
  event.ports[0].postMessage({
    message: 'Service Worker 已收到你的消息',
    data: event.data
  })
})
