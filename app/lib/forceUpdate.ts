"use client";

/**
 * 强制刷新到最新版。
 *
 * 为什么不能只用 location.reload()：
 *  - GitHub Pages 对所有静态资源发 `Cache-Control: max-age=600`，reload 可能又吃 HTTP 缓存
 *  - 用户设备上生效的可能是一个"缓存优先、且不认 SKIP_WAITING"的旧版 Service Worker，
 *    它会继续把缓存的旧页面还回来
 *
 * 所以这里做两步，且不依赖任何 SW 配合：
 *  1. 清空 Cache Storage —— 旧页面没得可还
 *     ⚠️ 用户数据存在 localStorage，与 Cache Storage 无关，清缓存不会动数据
 *  2. 用带时间戳的地址重新进入 —— 绕过 HTTP 缓存，强制走网络
 *
 * 页面加载后 UpdateBanner 会把 _u 参数清理掉。
 */
export const FORCE_FLAG = "_u";

export async function forceRefresh(): Promise<void> {
  // 1. 请等待中的新 SW 立刻接管（旧版不认这条消息也无妨，后续两步不依赖它）
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.waiting?.postMessage("SKIP_WAITING");
  } catch {
    /* 忽略 */
  }

  // 2. 清空 SW 缓存（只删缓存，不动 localStorage 里的用户数据）
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* 忽略 */
  }

  // 3. 带时间戳重新进入，强制走网络
  try {
    const u = new URL(location.href);
    u.searchParams.set(FORCE_FLAG, String(Date.now()));
    location.replace(u.toString());
  } catch {
    location.reload();
  }
}

/** 清掉强制刷新留在地址里的时间戳参数 */
export function cleanForceFlag(): void {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has(FORCE_FLAG)) return;
    u.searchParams.delete(FORCE_FLAG);
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch {
    /* 忽略 */
  }
}
