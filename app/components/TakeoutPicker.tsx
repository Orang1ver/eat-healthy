"use client";

import { useMemo, useState } from "react";
import { loadTakeoutDishes } from "../lib/storage";
import { categoryCounts, filterDishes, groupByRestaurant } from "../lib/takeoutView";
import type { DishRole } from "../lib/tags";
import type { Dish, TakeoutDish } from "../lib/types";
import { CategoryChips } from "./CategoryChips";

/** 一次最多渲染多少个匹配项：库里可能被导入几百道菜，全渲染会让弹窗在手机上很卡 */
const MAX_RENDERED = 200;

/**
 * 库里菜品的 `category` 是 AI 从截图里读出来的自由文本（"盖浇饭" "麻辣烫"…），
 * 而一餐里的 Dish 只有固定的 5 个角色 —— 这里按关键词大致映射一下，
 * 选中后用户仍能在菜品行的下拉里改。
 */
function roleForCategory(category: string): DishRole {
  const c = category || "";
  if (/饭|面|粉|米线|馒头|饼|饺|包|粥/.test(c)) return "主食";
  if (c.includes("汤")) return "汤";
  if (/甜|饮|奶/.test(c)) return "甜品";
  return "主菜";
}

/** 从菜单库点中的一道菜 → 记进这一餐的 Dish（库里没有食材数据，留空） */
export function dishFromTakeout(d: TakeoutDish): Dish {
  return {
    name: d.name,
    role: roleForCategory(d.category),
    ingredients: [],
    flavorTags: [...(d.flavorTags ?? [])],
  };
}

/**
 * 从「我的食堂/外卖库」里点菜，供补录/编辑一餐时使用。
 *
 * 设计取舍：
 * - **只读**：只 `loadTakeoutDishes()`，任何情况下都不写库（改库在「我的食堂/外卖库」页）。
 * - **判定"已选"用菜名**：Dish 里没有商家字段（MealRecord 也没有），所以两家店同名的菜会一起打勾。
 *   同一餐里出现两道完全同名的菜本来也没意义，所以按菜名增删是可接受的。
 * - **库为空时不占位**：由调用方通过 `showEmptyHint` 决定要不要给一句"先去加菜"的提示；
 *   没读完（dishes === null）时返回 null，避免首帧闪一下空态。
 */
export function TakeoutPicker({
  pickedNames,
  onToggle,
  hint = "点一下就加进这餐",
  showEmptyHint = false,
}: {
  /** 这一餐已有的菜名，用于给库里的菜打勾 */
  pickedNames: string[];
  /** 点一下库里的菜：调用方自己决定是加入还是移除 */
  onToggle: (dish: TakeoutDish) => void;
  /** 标题右边那句说明，各调用方语境不同 */
  hint?: string;
  /** 库为空时是否给提示（不显示时返回 null，完全不占位） */
  showEmptyHint?: boolean;
}) {
  /**
   * 开弹窗时才挂载（父组件关闭时返回 null → 本组件卸载），所以在这里惰性读一次库就够，
   * 每次打开都会拿到最新的库。**不用 useEffect 再 setState**：那会多一帧空态闪烁，
   * 而且这类"在 effect 里直接 setState"正是项目里要避免的写法。
   * SSR 下 `loadTakeoutDishes()` 自己会返回 `[]`（storage.read 有 window 判断），安全。
   */
  const [dishes] = useState<TakeoutDish[]>(() => loadTakeoutDishes());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  /** 品类 chip 用全库算（不随关键词抖动），位置稳定 */
  const categories = useMemo(() => categoryCounts(dishes), [dishes]);
  /** 选中的品类被改名/删光后自动退回「全部」（派生值，不写 effect） */
  const activeCategory = categories.some((c) => c.name === category) ? category : null;

  const shown = useMemo(
    () => filterDishes(dishes, { category: activeCategory, keyword: q }),
    [dishes, activeCategory, q],
  );

  /** 超出上限的部分不渲染，只提示缩小范围 */
  const limited = useMemo(() => shown.slice(0, MAX_RENDERED), [shown]);

  const grouped = useMemo(() => groupByRestaurant(limited), [limited]);

  if (dishes.length === 0) {
    if (!showEmptyHint) return null;
    return (
      <p className="mb-3 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
        菜单库还是空的 —— 先去「我的食堂/外卖库」加几道菜，这里就能一键选。
      </p>
    );
  }

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">🍱 从菜单库选</span>
        <span className="text-[12px]" style={{ color: "var(--heal-muted)" }}>
          {hint}
        </span>
      </div>
      <input
        className="mb-2 w-full rounded-full border px-3 py-1.5 text-xs"
        placeholder="搜菜名 / 商家"
        aria-label="搜索菜单库"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ borderColor: "var(--heal-card-border)" }}
      />
      {/* 品类筛选用单行横滑：弹窗位置紧张，品类再多也不顶高（库页那边用换行） */}
      <CategoryChips items={categories} total={dishes.length} active={activeCategory} onSelect={setCategory} layout="row" />
      {shown.length === 0 ? (
        <p className="py-2 text-center text-xs" style={{ color: "var(--heal-muted)" }}>
          {categories.length > 1 ? "没有匹配的菜，换个关键词或品类试试" : "没有匹配的菜，换个关键词试试"}
        </p>
      ) : (
        <div
          className="flex max-h-52 flex-col gap-2 overflow-y-auto rounded-2xl p-2"
          style={{ background: "var(--heal-bg)" }}
        >
          {grouped.map(({ restaurant, dishes: items }) => (
            <div key={restaurant}>
              <div className="mb-1 text-[12px]" style={{ color: "var(--heal-amber-deep)" }}>
                🏠 {restaurant}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((d) => {
                  const on = pickedNames.includes(d.name);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggle(d)}
                      className="heal-btn heal-pill px-2.5 py-1.5 text-xs"
                      style={
                        on
                          ? { background: "var(--heal-amber-50)", color: "var(--heal-amber-text)", border: "1px solid transparent" }
                          : { background: "var(--heal-card-bg)", color: "var(--heal-muted)", border: "0.5px solid var(--heal-card-border)" }
                      }
                    >
                      {on ? "✓ " : ""}
                      {d.name}
                      {d.priceRange ? (
                        <span className="ml-1" style={{ opacity: 0.7 }}>
                          {d.priceRange}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {shown.length > limited.length && (
            <p className="text-[12px]" style={{ color: "var(--heal-muted)" }}>
              还有 {shown.length - limited.length} 道，输关键词缩小范围
            </p>
          )}
        </div>
      )}
    </div>
  );
}
