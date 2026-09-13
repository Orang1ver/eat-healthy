/* 今天吃什么呀 —— 离线缓存 Service Worker
   只缓存同源静态资源；DeepSeek 等跨域请求一律直连，不缓存。

   版本化：CACHE 名里的 __BUILD__ 由 部署.bat 在每次发布时替换成时间戳。
   SW 字节一变浏览器就会更新它，activate 清掉旧版本缓存 ——
   保证部署后客户端不会一直卡在旧资源上。 */
const CACHE = "recipe-__BUILD__";
const CORE = ["./", "./health/", "./takeout/", "./weekly/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 逐个 add：用 addAll 的话，只要有一个路径 404，整个核心缓存都会失败且被静默吞掉
      Promise.all(CORE.map((url) => cache.add(url).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() =>
        // 新版本接管后，通知所有页面"有新版本了"，页面据此弹出更新横幅
        self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
        }),
      ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  // 页面点"立即更新"后跳过等待并通知所有页面刷新
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（AI 接口）不插手

  // 页面导航：网络优先且强制验证（不走 HTTP 缓存，部署后第一次打开必拿新版），
  // 离线时回退到缓存的对应页面
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
