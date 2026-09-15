"use client";

import { useEffect } from "react";
import { seedDefaultIngredientsIfEmpty, seedTakeoutMockIfEmpty } from "../lib/storage";
import { applyTheme, loadThemeChoice } from "../lib/theme";

/** 首次启动时预置默认数据、申请持久存储、把主题贴稳（SW 注册与更新检查由 UpdateBanner 统一负责） */
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

  /**
   * 主题。首帧已由 `app/layout.tsx` 的内联脚本把 `<html data-theme>` 贴好（所以不会闪），
   * 这里补两件它做不到的事：
   * 1) 顶栏 `theme-color`：内联脚本执行时 head 还没排完，取不到那条 meta；
   * 2) 选了「跟随系统」时，跟着系统在深/浅之间实时切换（用户中途改成跟随系统也能生效，
   *    所以监听器始终注册，回调里再判断当前选择）。
   */
  useEffect(() => {
    applyTheme(loadThemeChoice());
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (loadThemeChoice() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
