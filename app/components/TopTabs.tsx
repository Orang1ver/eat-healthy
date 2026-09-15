"use client";

import Link from "next/link";

/**
 * 顶部平级入口：🍳 今天吃什么 ｜ 💪 健康小屋。
 *
 * 为什么要有这个组件：原先健康小屋只是首页标题右边三个小按钮之一，和「本周回顾」同样大小
 * —— 看起来像附属功能。改成两个同尺寸的大入口后，健康与"吃"在视觉上同等份量，
 * 且在两个页面里都常驻（在健康小屋也能一键回到今天吃）。
 *
 * `active` 可选：周回顾页也挂这一条（方便直接去健康小屋），但它不属于这两个入口，
 * 两边都保持 ghost、不高亮。
 *
 * 用 `active` 显式传入而不用 `usePathname()`：静态导出 + 子路径部署下，
 * pathname 是否带 basePath 容易踩坑，而每页本来就知道自己在哪。
 * 站内跳转一律用 `next/link`（原生 <a> 不会自动加 basePath）。
 */
export function TopTabs({ active }: { active?: "eat" | "health" }) {
  const base = "heal-btn flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm";
  return (
    <nav className="mb-4 flex gap-2" aria-label="主要入口">
      <Link href="/" className={`${base} ${active === "eat" ? "heal-btn-primary" : "heal-btn-ghost"}`} aria-current={active === "eat" ? "page" : undefined}>
        🍳 今天吃什么
      </Link>
      <Link
        href="/health"
        className={`${base} ${active === "health" ? "heal-btn-feature" : "heal-btn-ghost"}`}
        aria-current={active === "health" ? "page" : undefined}
      >
        💪 健康小屋
      </Link>
    </nav>
  );
}
