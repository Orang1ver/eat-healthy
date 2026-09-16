"use client";

import { useEffect, useState } from "react";
import { TagChips } from "./TagChips";
import { FLAVOR_TAGS, AVOID_TAGS } from "../lib/tags";
import { TAKEOUT_CATEGORIES, canonicalCategory } from "../lib/takeoutCategories";
import { loadTakeoutDishes, pushTakeoutUndo, removeTakeoutDish, updateTakeoutDish } from "../lib/storage";
import type { TakeoutDish } from "../lib/types";

/**
 * 编辑菜单库里的一道菜：商家、菜名、类别、价格、口味标签、忌口冲突。
 * 从菜单库的菜品 pill 点开。
 */
export function EditDishDialog({
  dish,
  onClose,
  onSaved,
}: {
  dish: TakeoutDish | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [restaurant, setRestaurant] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [flavors, setFlavors] = useState<string[]>([]);
  const [avoids, setAvoids] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (dish) {
      setRestaurant(dish.restaurant);
      setName(dish.name);
      setCategory(canonicalCategory(dish.category, dish.name));
      setPrice(dish.priceRange || "");
      setFlavors(dish.flavorTags || []);
      setAvoids(dish.avoidConflicts || []);
      setErr("");
    }
  }, [dish]);

  if (!dish) return null;

  function save() {
    if (!dish) return;
    if (!name.trim()) {
      setErr("菜名不能为空");
      return;
    }
    // 价格格式宽松：¥12、12、12-15 都可以，原样存
    const ok = updateTakeoutDish(dish.id, {
      restaurant: restaurant.trim() || "学校食堂",
      name: name.trim(),
      category: category.trim() || "其他",
      priceRange: price.trim() || undefined,
      flavorTags: flavors,
      avoidConflicts: avoids,
    });
    if (!ok) {
      setErr("保存失败：同一家店里已经有同名菜了");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center heal-scrim p-4">
      <div className="heal-card flex max-h-[85vh] w-full max-w-md flex-col p-5" style={{ background: "var(--heal-card-bg)" }}>
        <h2 className="mb-1 text-base font-medium">✏️ 修改菜品</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--heal-muted)" }}>
          AI 识别错了、价格变了，都在这里改。
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs">商家 / 窗口</label>
              <input
                className="w-full rounded-xl border p-2 text-sm"
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">菜名</label>
              <input
                className="w-full rounded-xl border p-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">类别</label>
              {/* 固定下拉：自由文本会写出"快餐类""快餐简餐"这类近义名字，按品类筛选就废了 */}
              <select
                className="w-full rounded-xl border p-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ borderColor: "var(--heal-card-border)" }}
              >
                {TAKEOUT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs">价格</label>
              <input
                className="w-full rounded-xl border p-2 text-sm"
                placeholder="如 ¥12-15"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
          </div>

          <span className="mb-1 block text-xs">口味标签</span>
          <TagChips
            options={FLAVOR_TAGS.map((t) => t.label)}
            selected={flavors}
            onToggle={(l) => setFlavors((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))}
          />

          <span className="mb-1 mt-3 block text-xs">忌口冲突（如麻辣香锅 → 不吃辣）</span>
          <TagChips
            options={AVOID_TAGS.map((t) => t.label)}
            selected={avoids}
            onToggle={(l) => setAvoids((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))}
          />

          {err && <p className="mt-2 text-xs leading-5 text-rose-600">{err}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (!dish) return;
              if (!confirm(`删掉「${dish.name}」？\n\n可以回菜单库点「撤销上次操作」恢复。`)) return;
              pushTakeoutUndo(`删除了「${dish.name}」`, loadTakeoutDishes());
              removeTakeoutDish(dish.id);
              onSaved();
              onClose();
            }}
            className="heal-btn heal-btn-ghost px-3 py-2 text-sm"
            style={{ color: "var(--heal-danger)" }}
          >
            🗑️ 删除
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
              取消
            </button>
            <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
