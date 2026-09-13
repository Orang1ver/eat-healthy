"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "recipe.iosInstallHintDismissed.v1";

/** 是否运行在 iOS / iPadOS 上 */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ 的 UA 伪装成 Mac，用触摸点数区分
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** 是否已经「添加到主屏幕」以独立窗口运行 */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS 不会像安卓那样弹出安装提示，家人通常不知道要手动「添加到主屏幕」。
 * 这个横幅只在 iOS 的 Safari 里、且尚未添加到主屏时出现。
 */
export function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* 隐私模式等场景读不到就算了 */
    }
    if (isIOS() && !isStandalone()) setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 忽略 */
    }
    setShow(false);
  }

  return (
    <div className="heal-card mb-4 p-4 text-xs leading-6" style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="font-medium">📲 装成 App 用（推荐）</span>
        <button type="button" onClick={dismiss} aria-label="不再提示" className="shrink-0 opacity-60">
          ✕
        </button>
      </div>
      在 iPhone 上点底部「分享」⬆️ →「添加到主屏幕」，桌面就有图标，打开是全屏、无浏览器地址栏，用起来和 App 一样。
      <br />
      <span style={{ opacity: 0.75 }}>注意：要用 Safari 打开本页；微信/QQ 内置浏览器没有这个选项。</span>
    </div>
  );
}
