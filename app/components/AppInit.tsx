"use client";

import { useEffect } from "react";
import { seedDefaultIngredientsIfEmpty, seedTakeoutMockIfEmpty } from "../lib/storage";

/** 首次启动时预置默认数据、申请持久存储（SW 注册与更新检查由 UpdateBanner 统一负责） */
export function AppInit() {
  useEffect(() => {
    seedDefaultIngredientsIfEmpty();
    seedTakeoutMockIfEmpty();

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
