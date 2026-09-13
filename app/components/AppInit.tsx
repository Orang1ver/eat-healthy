"use client";

import { useEffect } from "react";
import { seedDefaultIngredientsIfEmpty, seedTakeoutMockIfEmpty } from "../lib/storage";

/** 首次启动时预置默认数据、注册 Service Worker、申请持久存储 */
export function AppInit() {
  useEffect(() => {
    seedDefaultIngredientsIfEmpty();
    seedTakeoutMockIfEmpty();

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
        /* 注册失败不影响正常使用 */
      });
    }

    /**
     * 申请持久存储。已「添加到主屏幕」的 Web App 本身就豁免 Safari 的 7 天清除规则，
     * 但还有一条"长期不访问即回收"的规则，只有 persist() 能挡。被拒也不影响使用。
     */
    navigator.storage?.persist?.().catch(() => {
      /* 用户拒绝或浏览器不支持，忽略 */
    });
  }, []);
  return null;
}
