"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "recipe.updateBannerDismissed.v1";

/** SW 注册路径（带 basePath，兼容子路径部署） */
function swUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return { url: `${base}/sw.js`, scope: `${base}/` };
}

/**
 * 「发现新版本」横幅。
 *
 * 为什么需要它 + 需要注意什么：
 * GitHub Pages 对 sw.js 也发 `Cache-Control: max-age=600`，浏览器做 SW 更新检查时
 * 可能直接吃 HTTP 缓存拿到旧脚本，于是「检测不到新版本」。iOS 主屏 App 尤其顽固。
 * 对策：
 *  1. 注册时 updateViaCache: "none" —— 更新检查绕过 HTTP 缓存（标准做法）
 *  2. 每次回到 App（visibilitychange → visible）主动 reg.update() 查一次
 *  3. 检测到新 SW 就显示横幅，用户点一下即切换并刷新
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 清掉上一轮「立即更新」留下的 _u 时间戳，保持地址干净
    try {
      const u = new URL(location.href);
      if (u.searchParams.has("_u")) {
        u.searchParams.delete("_u");
        history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      }
    } catch {
      /* 忽略 */
    }

    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(DISMISS_KEY);
    } catch {
      /* 忽略 */
    }
    const reveal = () => {
      if (!dismissed) setShow(true);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "SW_UPDATED") reveal();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const { url, scope } = swUrl();
    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register(url, { scope, updateViaCache: "none" })
      .then((r) => {
        reg = r;

        // 已经有新 SW 在等待接管（例如广播发出时页面还没挂载）
        if (r.waiting && navigator.serviceWorker.controller) reveal();

        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "activated" && navigator.serviceWorker.controller) reveal();
          });
        });

        // 主动查一次（注册本身不保证立刻检查）
        r.update().catch(() => {});
      })
      .catch(() => {});

    // 回到 App 就查一次：iOS 主屏 App 经常是常驻后台再切回，每次切回都是更新机会
    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    // 兜底：久开的页面也定期查（10 分钟一次，很轻）
    const timer = setInterval(() => reg?.update().catch(() => {}), 10 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  /**
   * 「立即更新」必须做到两件事，否则 iOS 上会"点了没反应"：
   *  1. 清掉 SW 的 Cache Storage —— 否则重载时旧 SW 仍把缓存的旧页面还给你。
   *     注意：用户数据存在 localStorage，与 Cache Storage 无关，清缓存不会动数据。
   *  2. 用带时间戳的地址强制重新拉取 —— 绕过 GitHub Pages 的 max-age=600 HTTP 缓存，
   *     这样即使当前生效的是"没有 SKIP_WAITING 处理器"的旧版 SW，也一定能拿到新页面。
   */
  async function update() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* 忽略 */
    }
    setShow(false);

    // 1. 请等待中的新 SW 立刻接管（旧版 SW 不认这条消息，无所谓，下面两步不依赖它）
    try {
      const reg = await navigator.serviceWorker.getRegistration();
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
      u.searchParams.set("_u", String(Date.now()));
      location.replace(u.toString());
    } catch {
      location.reload();
    }
  }

  if (!show) return null;

  return (
    <div
      className="heal-card mx-auto mb-4 flex w-full max-w-2xl items-center justify-between gap-2 p-3"
      style={{ background: "var(--heal-blue-50)" }}
    >
      <span className="text-xs leading-5" style={{ color: "var(--heal-blue-text)" }}>
        ✨ 发现新版本，点这里更新
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* 忽略 */
            }
            setShow(false);
          }}
          className="heal-btn heal-btn-ghost px-2 py-1 text-[11px]"
        >
          下次再说
        </button>
        <button type="button" onClick={update} className="heal-btn heal-btn-primary px-3 py-1 text-xs">
          立即更新
        </button>
      </div>
    </div>
  );
}
