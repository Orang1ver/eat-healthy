import type { ExerciseAwards, ExerciseRecord, ExerciseType } from "./types";
import { addDays } from "./date";

/**
 * 运动记录的计算辅助：类型选项、排序、累计/本周统计、里程碑判定。
 * 只做纯计算，不碰存储，方便单独推演。
 */

export const EXERCISE_TYPES: { key: ExerciseType; emoji: string; hint: string }[] = [
  { key: "散步", emoji: "🚶", hint: "时长或距离" },
  { key: "跑步", emoji: "🏃", hint: "距离更有意义" },
  { key: "爬山", emoji: "⛰️", hint: "时长或距离" },
  { key: "徒步", emoji: "🥾", hint: "距离更有意义" },
  { key: "骑行", emoji: "🚴", hint: "距离" },
  { key: "游泳", emoji: "🏊", hint: "时长" },
  { key: "球类", emoji: "⚽", hint: "时长" },
  { key: "其他", emoji: "✨", hint: "" },
];

/** 是否为「徒步类」（用于徒步/爬山里程碑） */
export function isHikeType(t: ExerciseType): boolean {
  return t === "爬山" || t === "徒步";
}

/** 按日期（同日按 at）倒序，最新在前 */
export function sortExercises(list: ExerciseRecord[]): ExerciseRecord[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.at - a.at : b.date.localeCompare(a.date)));
}

export type ExerciseStats = {
  count: number; // 总次数
  minutes: number; // 总时长
  km: number; // 总里程（保留一位小数）
  hikeCount: number; // 爬山 + 徒步次数
  activeDays: number; // 有记录的天数
};

export function exerciseStats(list: ExerciseRecord[]): ExerciseStats {
  const days = new Set<string>();
  let minutes = 0;
  let km = 0;
  let hikeCount = 0;
  for (const r of list) {
    days.add(r.date);
    minutes += r.minutes ?? 0;
    km += r.distanceKm ?? 0;
    if (isHikeType(r.type)) hikeCount++;
  }
  return { count: list.length, minutes, km: round1(km), hikeCount, activeDays: days.size };
}

/** 某一周（周一 ~ 周日）的统计 */
export function weekStats(list: ExerciseRecord[], weekStartISO: string): ExerciseStats {
  const weekEnd = addDays(weekStartISO, 6);
  return exerciseStats(list.filter((r) => r.date >= weekStartISO && r.date <= weekEnd));
}

export type ExerciseMilestone = {
  id: string;
  emoji: string;
  label: string;
  /** 达成条件（纯函数，便于推演与测试） */
  test: (s: ExerciseStats) => boolean;
  /** 未达成时的进度文案，如 "还差 3 次" */
  progress: (s: ExerciseStats) => string;
};

export const EXERCISE_MILESTONES: ExerciseMilestone[] = [
  { id: "ex-first", emoji: "🌱", label: "第一次运动", test: (s) => s.count >= 1, progress: () => "还差 1 次" },
  { id: "ex-count-10", emoji: "🎯", label: "累计 10 次", test: (s) => s.count >= 10, progress: (s) => `还差 ${Math.max(0, 10 - s.count)} 次` },
  { id: "ex-count-30", emoji: "🏅", label: "累计 30 次", test: (s) => s.count >= 30, progress: (s) => `还差 ${Math.max(0, 30 - s.count)} 次` },
  { id: "ex-km-50", emoji: "🏃", label: "累计 50km", test: (s) => s.km >= 50, progress: (s) => `还差 ${round1(Math.max(0, 50 - s.km))}km` },
  { id: "ex-km-100", emoji: "🏔️", label: "累计 100km", test: (s) => s.km >= 100, progress: (s) => `还差 ${round1(Math.max(0, 100 - s.km))}km` },
  { id: "ex-hike-10", emoji: "🥾", label: "徒步/爬山 10 次", test: (s) => s.hikeCount >= 10, progress: (s) => `还差 ${Math.max(0, 10 - s.hikeCount)} 次` },
];

/** 阈值已达成且尚未拥有（与 rewards.ts 的 pendingBadges 同模式） */
export function pendingMilestones(stats: ExerciseStats, owned: ExerciseAwards): ExerciseMilestone[] {
  return EXERCISE_MILESTONES.filter((m) => m.test(stats) && !owned[m.id]);
}

/** 下一个未达成的里程碑（用于「还差 X」），全达成则 null */
export function nextMilestone(stats: ExerciseStats, owned: ExerciseAwards): ExerciseMilestone | null {
  return EXERCISE_MILESTONES.find((m) => !m.test(stats) && !owned[m.id]) ?? null;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
