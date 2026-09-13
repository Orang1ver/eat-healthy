"use client";

import { useEffect } from "react";
import { seedDefaultIngredientsIfEmpty, seedTakeoutMockIfEmpty } from "../lib/storage";

/** 首次启动时预置默认数据，并在生产环境注册 Service Worker（支持离线/加到主屏） */
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
  }, []);
  return null;
}
