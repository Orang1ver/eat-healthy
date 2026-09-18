import { categoryCounts, groupByRestaurant } from "./takeoutView";
import type { TakeoutDish } from "./types";

/**
 * 菜单库导出。
 *
 * 两种格式，用途不同（这也是"哪种 AI 最好读"的答案）：
 * - **文字版（Markdown 清单）**：给 AI 阅读/对话用最好 —— 按商家分段、一行一道菜，
 *   模型不用先解析结构就能抓住"哪家有什么菜、多少钱、什么口味"，也最省 token；
 *   而且这个形态正好是本 App「文字导入」能直接吃进去的东西，所以还能拿来在另一台设备上重建菜单库。
 * - **JSON**：给程序或需要精确字段的场景 —— 字段名无歧义、可直接解析，人看着累但机器最稳。
 *   （不带 id：导入时会按"商家+菜名"重新生成，带着反而容易让人以为要按 id 对齐。）
 *
 * 这里只做纯字符串转换，不碰 localStorage、不下载（下载/复制在页面里做）。
 */

export type ExportFormat = "text" | "json";

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  text: "文字版（推荐给 AI）",
  json: "JSON（给程序/精确解析）",
};

/** 菜单库 → 一段 Markdown 清单 */
export function toMarkdown(dishes: TakeoutDish[], todayISO: string): string {
  const groups = groupByRestaurant(dishes);
  const cats = categoryCounts(dishes);

  const head = [
    "# 我的食堂/外卖菜单库",
    "",
    `导出时间：${todayISO} ｜ 共 ${dishes.length} 道菜、${groups.length} 个商家/窗口、${cats.length} 个品类`,
    "",
    "> 给 AI 的说明：下面每个二级标题是一家商家/窗口，标题下每行是一道菜，格式为",
    "> 「- 菜名 ¥价格 ｜ 品类 ｜ 口味：xxx ｜ 忌口冲突：xxx」（没有的字段会省略）。",
    "> 请只根据这份清单来推荐、搭配或排菜，不要编造清单里没有的商家或菜。",
    "",
  ].join("\n");

  const body = groups
    .map(({ restaurant, dishes: items }) => {
      const lines = items.map((d) => {
        const parts = [d.name, d.priceRange ? d.priceRange : "", d.category?.trim() || "其他"];
        const flavor = (d.flavorTags || []).filter(Boolean);
        const avoid = (d.avoidConflicts || []).filter(Boolean);
        let line = `- ${parts[0]}${parts[1] ? ` ${parts[1]}` : ""} ｜ ${parts[2]}`;
        if (flavor.length) line += ` ｜ 口味：${flavor.join("、")}`;
        if (avoid.length) line += ` ｜ 忌口冲突：${avoid.join("、")}`;
        return line;
      });
      return [`## ${restaurant}`, ...lines, ""].join("\n");
    })
    .join("\n");

  return `${head}\n${body}`.trimEnd() + "\n";
}

/** 菜单库 → 一个自描述的 JSON 文档（缩进 2 空格，方便人肉扫一眼） */
export function toJson(dishes: TakeoutDish[], todayISO: string): string {
  const cats = categoryCounts(dishes).map((c) => c.name);
  const doc = {
    format: "eat-healthy.takeout-library",
    version: 1,
    exportedAt: todayISO,
    count: dishes.length,
    restaurants: groupByRestaurant(dishes).length,
    categories: cats,
    note: "「今天吃什么呀」菜单库导出。dishes 每一项与原库的 restaurant/name/category/priceRange/flavorTags/avoidConflicts 一致；未导出 id（导入时会按商家+菜名重新生成）。",
    dishes: dishes.map((d) => ({
      restaurant: d.restaurant,
      name: d.name,
      category: d.category?.trim() || "其他",
      priceRange: d.priceRange ?? null,
      flavorTags: d.flavorTags || [],
      avoidConflicts: d.avoidConflicts || [],
    })),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

/** 按格式取内容 */
export function exportContent(dishes: TakeoutDish[], format: ExportFormat, todayISO: string): string {
  return format === "json" ? toJson(dishes, todayISO) : toMarkdown(dishes, todayISO);
}

/** `菜单库-2026-09-17.json` / `菜单库-2026-09-17.md` */
export function exportFileName(todayISO: string, format: ExportFormat): string {
  return `菜单库-${todayISO}.${format === "json" ? "json" : "md"}`;
}
