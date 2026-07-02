"use client";

import { useEffect, useState } from "react";

export function ShoppingList({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 食材列表变了（比如换一桌/重新生成）就重置勾选状态
  useEffect(() => {
    setChecked(new Set());
  }, [items.join("|")]);

  if (items.length === 0) return null;

  function toggle(item: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  return (
    <div
      className="mb-3 rounded-2xl px-3 py-2 text-sm"
      style={{ background: "var(--heal-amber-50)", color: "var(--heal-amber-text)" }}
    >
      <div className="mb-1 font-medium">🛒 购物清单</div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const isChecked = checked.has(item);
          return (
            <label key={item} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={isChecked} onChange={() => toggle(item)} />
              <span style={isChecked ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>{item}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
