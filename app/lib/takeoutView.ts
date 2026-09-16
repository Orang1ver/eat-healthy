import type { TakeoutDish } from "./types";

/**
 * 菜单库的「看库」逻辑：品类归一化、计数、关键词/品类过滤、按商家/按品类分组。
 *
 * 为什么单独一个模块：菜单库页（`app/takeout/page.tsx`）和补录时的「从菜单库选」
 * （`app/components/TakeoutPicker.tsx`）需要**完全一样**的过滤与分组语义 ——
 * 两处各写一遍迟早会飘。这里只放纯函数，不碰 localStorage、不碰 React。
 */

/** 品类的兜底名：老数据/手填都可能是空字符串 */
export const OTHER_CATEGORY = "其他";

export type CategoryCount = { name: string; count: number };
export type RestaurantGroup = { restaurant: string; dishes: TakeoutDish[] };
export type CategoryGroup = { category: string; dishes: TakeoutDish[] };

/** 一道菜的品类（trim 后为空就算「其他」，避免出现空标题的组） */
export function dishCategory(d: TakeoutDish): string {
  const c = (d.category || "").trim();
  return c || OTHER_CATEGORY;
}

/** 品类 + 该品类菜品数：数量多的在前，同数量按名字排（顺序稳定，chip 行不会跳） */
export function categoryCounts(dishes: TakeoutDish[]): CategoryCount[] {
  const map = new Map<string, number>();
  for (const d of dishes) {
    const c = dishCategory(d);
    map.set(c, (map.get(c) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 关键词匹配菜名 / 商家 / 品类，不区分大小写；空关键词一律通过 */
export function matchesKeyword(d: TakeoutDish, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return `${d.name}${d.restaurant}${d.category ?? ""}`.toLowerCase().includes(kw);
}

/** 品类（单选，null = 全部）与关键词是 **AND** 关系 */
export function filterDishes(
  dishes: TakeoutDish[],
  opts: { category?: string | null; keyword?: string } = {},
): TakeoutDish[] {
  const category = opts.category ?? null;
  const keyword = opts.keyword ?? "";
  return dishes.filter((d) => (!category || dishCategory(d) === category) && matchesKeyword(d, keyword));
}

/** 按某个字符串键分组；组内保持传入顺序，组间按键名排序（与原来的商家分组一致） */
function groupBy(dishes: TakeoutDish[], keyOf: (d: TakeoutDish) => string): { key: string; dishes: TakeoutDish[] }[] {
  const map = new Map<string, TakeoutDish[]>();
  for (const d of dishes) {
    const k = keyOf(d);
    const arr = map.get(k) || [];
    arr.push(d);
    map.set(k, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => ({ key, dishes: items }));
}

export function groupByRestaurant(dishes: TakeoutDish[]): RestaurantGroup[] {
  return groupBy(dishes, (d) => d.restaurant || "学校食堂").map((g) => ({ restaurant: g.key, dishes: g.dishes }));
}

export function groupByCategory(dishes: TakeoutDish[]): CategoryGroup[] {
  return groupBy(dishes, dishCategory).map((g) => ({ category: g.key, dishes: g.dishes }));
}
