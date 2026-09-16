"use client";

import type { CSSProperties } from "react";
import type { CategoryCount } from "../lib/takeoutView";

const ON: CSSProperties = { background: "var(--heal-amber-50)", color: "var(--heal-amber-text)", border: "1px solid transparent" };
const OFF: CSSProperties = { background: "var(--heal-card-bg)", color: "var(--heal-muted)", border: "0.5px solid var(--heal-card-border)" };

/**
 * 品类筛选 chip 行：第一个固定是「全部 N」，其后每个品类带自己的菜品数。
 *
 * - **单选**：再点一下当前选中的品类 = 回到「全部」（chip 的常规语义，不用去找"全部"）。
 * - 配色跟 `TagChips` 一套 token，深浅主题自动生效。
 * - `layout`：`wrap` 用于菜单库页（页面可以往下长）；`row` 用于弹窗，单行横向滚动，
 *   品类再多也不会把弹窗顶高。库里有几道菜就有几个品类时才有意义 → ≤1 个品类直接不渲染。
 */
export function CategoryChips({
  items,
  total,
  active,
  onSelect,
  layout = "wrap",
  label,
}: {
  items: CategoryCount[];
  /** 全库菜品数，给「全部 N」用 */
  total: number;
  /** 当前选中的品类，null = 全部 */
  active: string | null;
  onSelect: (name: string | null) => void;
  layout?: "wrap" | "row";
  /** 可选的前缀说明，如「品类」；弹窗里位置紧张就不传 */
  label?: string;
}) {
  if (items.length <= 1) return null;

  const box = layout === "row" ? "mb-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1" : "mb-2 flex flex-wrap items-center gap-1.5";

  return (
    <div className={box}>
      {label && (
        <span className="shrink-0 text-[12px]" style={{ color: "var(--heal-muted)" }}>
          {label}
        </span>
      )}
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => onSelect(null)}
        className="heal-btn shrink-0 px-2.5 py-1 text-[12px]"
        style={active === null ? ON : OFF}
      >
        全部 {total}
      </button>
      {items.map((c) => (
        <button
          key={c.name}
          type="button"
          aria-pressed={active === c.name}
          onClick={() => onSelect(active === c.name ? null : c.name)}
          className="heal-btn shrink-0 px-2.5 py-1 text-[12px]"
          style={active === c.name ? ON : OFF}
        >
          {c.name} {c.count}
        </button>
      ))}
    </div>
  );
}
