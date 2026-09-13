import type { DailyCheckin, RewardState } from "./types";
import type { DailyHealthTargets } from "./health";
import { addDays } from "./date";

/**
 * 打卡奖励：判定「今日是否完成」、计算连续天数、发放里程碑徽章。
 *
 * 完成标准（与用户确认过）：喝水达标 且 步数达标。
 * 判定依赖健康档案算出的 targets，所以没填档案时不判定、不发奖励。
 */

// ---------- 判定 ----------

export type CheckinCompletion = {
  waterDone: boolean;
  stepsDone: boolean;
  /** 两项都达标才算今天完成 */
  allDone: boolean;
};

export function evaluateCheckin(
  checkin: Pick<DailyCheckin, "waterMl" | "steps"> | null | undefined,
  targets: Pick<DailyHealthTargets, "waterTarget" | "stepsTarget"> | null | undefined,
): CheckinCompletion {
  if (!targets) return { waterDone: false, stepsDone: false, allDone: false };
  const waterDone = (checkin?.waterMl ?? 0) >= targets.waterTarget;
  const stepsDone = (checkin?.steps ?? 0) >= targets.stepsTarget;
  return { waterDone, stepsDone, allDone: waterDone && stepsDone };
}

// ---------- 连续天数 ----------

/** 从某天起往前，连续达标了多少天（含起点当天） */
function countBack(days: Record<string, unknown>, fromISO: string, limit = 400): number {
  let n = 0;
  let cursor = fromISO;
  while (n < limit && days[cursor]) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * 当前连续天数。
 * 今天已达标就从今天数；今天还没达标则从昨天数 —— 否则白天一打开就显示 0 天，
 * 明明昨天刚坚持过却像断签了，很打击人。
 */
export function calcCurrentStreak(days: Record<string, unknown>, todayISO: string): number {
  if (days[todayISO]) return countBack(days, todayISO);
  return countBack(days, addDays(todayISO, -1));
}

/** 历史最长连续（用于徽章授予，断签后已获得的徽章不收回） */
export function calcMaxStreak(days: Record<string, { streak: number }>): number {
  let max = 0;
  for (const d of Object.values(days)) {
    if (d && typeof d.streak === "number" && d.streak > max) max = d.streak;
  }
  // 兼容：若历史数据里 streak 字段异常，用逐日回查兜底
  return Math.max(max, calcLongestByScan(days));
}

/** 逐日扫描求最长连续段（不依赖已存的 streak 值） */
function calcLongestByScan(days: Record<string, unknown>): number {
  const dates = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

// ---------- 徽章 ----------

export type Badge = {
  id: string;
  days: number;
  emoji: string;
  label: string;
};

export const BADGES: Badge[] = [
  { id: "streak-3", days: 3, emoji: "🌱", label: "坚持 3 天" },
  { id: "streak-7", days: 7, emoji: "🌿", label: "一周不落" },
  { id: "streak-14", days: 14, emoji: "🌳", label: "两周坚持" },
  { id: "streak-30", days: 30, emoji: "🏅", label: "满月达成" },
  { id: "streak-60", days: 60, emoji: "🏆", label: "两月坚持" },
  { id: "streak-100", days: 100, emoji: "👑", label: "百日打卡" },
];

/** 按连续天数，算出这次新拿到的徽章 */
export function pendingBadges(streak: number, owned: Record<string, string>): Badge[] {
  return BADGES.filter((b) => streak >= b.days && !owned[b.id]);
}

/** 下一个还没拿到的徽章（用于"还差 N 天"提示） */
export function nextBadge(owned: Record<string, string>): Badge | null {
  return BADGES.find((b) => !owned[b.id]) ?? null;
}

// ---------- 状态与结算 ----------

export const EMPTY_REWARDS: RewardState = { days: {}, badges: {}, celebrated: [] };

export function normalizeRewards(raw: unknown): RewardState {
  const r = (raw ?? {}) as Partial<RewardState>;
  return {
    days: r.days && typeof r.days === "object" ? r.days : {},
    badges: r.badges && typeof r.badges === "object" ? r.badges : {},
    celebrated: Array.isArray(r.celebrated) ? r.celebrated : [],
  };
}

export type SettleResult = {
  state: RewardState;
  /** 这次是否首次达标（决定要不要弹庆祝） */
  firstTimeToday: boolean;
  streak: number;
  /** 这次新获得的徽章 */
  newBadges: Badge[];
};

/**
 * 结算一次打卡。幂等：同一天重复调用只记一次、只庆祝一次。
 * 奖励只发不收 —— 事后把水量减下去不会撤销已达成的记录。
 */
export function settleCheckin(prev: RewardState, todayISO: string): SettleResult {
  const state = normalizeRewards(prev);

  // 今天之前已经记录过（且庆祝过）→ 原样返回，不重复弹
  if (state.days[todayISO]) {
    return {
      state,
      firstTimeToday: false,
      streak: state.days[todayISO].streak,
      newBadges: [],
    };
  }

  const days = { ...state.days, [todayISO]: { streak: 0, at: Date.now() } };
  // 写入占位后再算连续天数，这样 countBack 能数到今天
  const streak = countBack(days, todayISO);
  days[todayISO] = { streak, at: Date.now() };

  const newBadges = pendingBadges(streak, state.badges);
  const badges = { ...state.badges };
  for (const b of newBadges) badges[b.id] = todayISO;

  const celebrated = state.celebrated.includes(todayISO)
    ? state.celebrated
    : [...state.celebrated, todayISO];

  return {
    state: { days, badges, celebrated },
    firstTimeToday: true,
    streak,
    newBadges,
  };
}

/** 已经庆祝过今天就返回 true（用于避免重复弹窗） */
export function hasCelebrated(state: RewardState, todayISO: string): boolean {
  return state.celebrated.includes(todayISO);
}
