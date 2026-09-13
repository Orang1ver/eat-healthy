"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "recipe.updateBannerDismissed.v1";

/**
 * 「发现新版本」横幅。
 *
 * 原理：sw.js activate 时会向所有页面广播 SW_UPDATED（每次部署 CACHE 版本号都变，
 * 新 SW 必然 activate 一次）。页面收到广播后显示横幅，点击 → 通知 SW skipWaiting
 * 并整页刷新，即进入新版。iOS 主屏 App 没有刷新按钮，这条横幅是它的更新入口。
 *
 * 只有"已经有一个旧 SW 在控制页面"时才提示——首次安装本来拿到就是新版，不用提示。
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(DISMISS_KEY);
    } catch {
      /* 忽略 */
    }

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "SW_UPDATED" && !dismissed) setShow(true);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    navigator.serviceWorker
      .register(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/sw.js`, {
        scope: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`,
      })
      .then((r) => {
        // 页面加载时新 SW 已经在等待接管（比如广播发出时页面还没挂载）——立即提示
        if (r.waiting && !dismissed) setShow(true);
        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "activated" && navigator.serviceWorker.controller && !dismissed) {
              setShow(true);
            }
          });
        });
      })
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  function update() {
    setShow(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* 忽略 */
    }
    navigator.serviceWorker.controller?.postMessage("SKIP_WAITING");
    // 新 SW 接管后整页刷新，加载新版资源
    setTimeout(() => location.reload(), 150);
  }

  if (!show) return null;

  return (
    <div
      className="heal-card mb-4 flex items-center justify-between gap-2 p-3"
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
