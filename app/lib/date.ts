/** 本地日期字符串 "2026-06-30" */
export function todayISO(): string {
  const d = new Date();
  return formatDateISO(d);
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 给定日期所在周的周一日期（ISO 字符串） */
export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const dow = d.getDay(); // 0=周日
  const diff = dow === 0 ? -6 : 1 - dow; // 调整到周一
  d.setDate(d.getDate() + diff);
  return formatDateISO(d);
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 给定周一日期，返回该周 7 天的 ISO 日期数组 */
export function weekDates(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
}

export function formatWeekRange(weekStartISO: string): string {
  const end = addDays(weekStartISO, 6);
  return `${weekStartISO} ~ ${end}`;
}

/** 当前本地时间 "HH:mm" */
export function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 由具体时间推导一个语义餐次标签，仅用于 AI prompt 语境，不用于 UI 分组 */
export function mealSlotFromTime(time: string): "早餐" | "午餐" | "晚餐" | "加餐" {
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + (m || 0);
  if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return "早餐";
  if (minutes >= 10 * 60 + 30 && minutes < 14 * 60) return "午餐";
  if (minutes >= 17 * 60 + 30 && minutes < 21 * 60 + 30) return "晚餐";
  return "加餐";
}

/** 兼容旧数据：早期版本没有 time 字段，只有固定餐次，给它一个近似时间用于排序展示 */
export function approxTimeForSlot(slot?: string): string {
  switch (slot) {
    case "早餐":
      return "08:00";
    case "午餐":
      return "12:00";
    case "晚餐":
      return "19:00";
    case "加餐":
    default:
      return "15:00";
  }
}
