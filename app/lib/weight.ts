import type { WeightEntry } from "./types";
import { addDays } from "./date";

/**
 * 体重记录的计算辅助：排序、与上次/若干天前的差值、图表区间。
 * 只做纯计算，不碰存储，方便单独推演。
 */

/** 按日期升序排列 */
export function sortWeights(all: Record<string, WeightEntry>): WeightEntry[] {
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
}

/** 最近一次记录（没有则 null） */
export function latestWeight(all: Record<string, WeightEntry>): WeightEntry | null {
  const list = sortWeights(all);
  return list.length ? list[list.length - 1] : null;
}

/** 某一天的记录（没有则 null） */
export function entryOn(all: Record<string, WeightEntry>, dateISO: string): WeightEntry | null {
  return all[dateISO] ?? null;
}

/** 严格早于该日期的最近一条记录 —— 补录那天的"上一次"就是它 */
export function latestBefore(all: Record<string, WeightEntry>, dateISO: string): WeightEntry | null {
  const list = sortWeights(all).filter((e) => e.date < dateISO);
  return list.length ? list[list.length - 1] : null;
}

/**
 * 记录某天时的起始草稿值：
 * 该日已有 → 用已记的值；否则用更早的最近一条做起点；再否则用最新一条；
 * 再否则用健康档案里的体重；最后兜底 60。
 *
 * 为什么要这串兜底：补录时若从 60kg 起步，用户得连点几十下才到自己的体重。
 */
export function baselineForDate(
  all: Record<string, WeightEntry>,
  dateISO: string,
  fallbackWeight: number | null,
): number {
  const on = entryOn(all, dateISO);
  if (on) return round1(on.weightKg);
  const before = latestBefore(all, dateISO);
  if (before) return round1(before.weightKg);
  const latest = latestWeight(all);
  if (latest) return round1(latest.weightKg);
  return round1(fallbackWeight ?? 60);
}

export type Delta = {
  /** 差值（正为增重，负为减重） */
  diff: number;
  /** 用于对比的那次记录 */
  from: WeightEntry;
};

/** 与上一次记录相比 */
export function deltaVsPrevious(all: Record<string, WeightEntry>): Delta | null {
  const list = sortWeights(all);
  if (list.length < 2) return null;
  const cur = list[list.length - 1];
  const prev = list[list.length - 2];
  return { diff: round1(cur.weightKg - prev.weightKg), from: prev };
}

/** 与「若干天前最近的一条」相比（用于"近 7 天变化"） */
export function deltaVsDaysAgo(all: Record<string, WeightEntry>, todayISO: string, days: number): Delta | null {
  const cutoff = addDays(todayISO, -days);
  const list = sortWeights(all).filter((e) => e.date <= cutoff);
  if (list.length === 0) return null;
  const base = list[list.length - 1];
  const latest = latestWeight(all);
  if (!latest || latest.date === base.date) return null;
  return { diff: round1(latest.weightKg - base.weightKg), from: base };
}

/** 图表用的数值区间（上下留 10% 余量，避免线贴着边框） */
export function weightRange(entries: WeightEntry[]): { min: number; max: number } {
  if (entries.length === 0) return { min: 0, max: 1 };
  const values = entries.map((e) => e.weightKg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return { min: lo - 1, max: hi + 1 };
  const pad = (hi - lo) * 0.1;
  return { min: round1(lo - pad), max: round1(hi + pad) };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 差值的展示文案，如 "↑0.3" / "↓0.2" / "持平" */
export function deltaText(diff: number): string {
  if (Math.abs(diff) < 0.05) return "持平";
  return diff > 0 ? `↑${Math.abs(diff).toFixed(1)}` : `↓${Math.abs(diff).toFixed(1)}`;
}

/** 差值颜色：减重偏蓝（正反馈）、增重偏琥珀，持平用灰 */
export function deltaColor(diff: number): string {
  if (Math.abs(diff) < 0.05) return "var(--heal-muted)";
  return diff > 0 ? "var(--heal-amber-deep)" : "var(--heal-blue-text)";
}
