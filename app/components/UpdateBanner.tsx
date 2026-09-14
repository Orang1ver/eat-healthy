"use client";

import { useEffect, useState } from "react";
import { cleanForceFlag, forceRefresh } from "../lib/forceUpdate";

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
  /** 新版本号（SW 广播带过来），拿不到就为空 */
  const [nextVersion, setNextVersion] = useState("");
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "";

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 清掉上一轮「立即更新」留下的 _u 时间戳，保持地址干净
    cleanForceFlag();

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
      // SW 只在"确实替换了旧版本"时才广播（它自己会判断有没有旧缓存），
      // 所以这里可以直接信任——不要用页面挂载时的 controller 状态来判断，
      // 那个值在"首访时无控制者、之后 SW 才接管"的场景下会过期，
      // 导致横幅永远不显示（iOS 主屏 App 常驻后台不重载，最容易踩到）。
      if (e.data?.type === "SW_UPDATED") {
        if (typeof e.data.version === "string") setNextVersion(e.data.version);
        reveal();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const { url, scope } = swUrl();
    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register(url, { scope, updateViaCache: "none" })
      .then((r) => {
        reg = r;

        // 已经有新 SW 在等待接管（例如广播发出时页面还没挂载）
        if (r.waiting && r.active) reveal();

        r.addEventListener("updatefound", () => {
          // 判断"这次是不是真升级"：updatefound 触发时若已有 active worker，
          // 说明是旧版被替换；首次安装时 reg.active 还是 null。
          // 用此刻的值判断，而不是页面挂载时的快照。
          const isUpgrade = !!r.active;
          const nw = r.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "activated" && isUpgrade) reveal();
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

  /** 「立即更新」：清缓存 + 时间戳重进（实现见 lib/forceUpdate.ts） */
  function update() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* 忽略 */
    }
    setShow(false);
    forceRefresh();
  }

  if (!show) return null;

  // 版本不同就把"从哪升到哪"说清楚；拿不到版本就退回通用文案
  const versionText =
    nextVersion && currentVersion && nextVersion !== currentVersion
      ? `✨ 发现新版本 ${currentVersion} → ${nextVersion}`
      : "✨ 发现新版本，点这里更新";

  return (
    <div
      className="heal-card mx-auto mb-4 flex w-full max-w-2xl items-center justify-between gap-2 p-3"
      style={{ background: "var(--heal-blue-50)" }}
    >
      <span className="text-xs leading-5" style={{ color: "var(--heal-blue-text)" }}>
        {versionText}
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
