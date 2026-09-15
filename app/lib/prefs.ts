import { DEFAULT_CUP_ML, clampCupMl } from "./steps";

/**
 * 应用偏好：「我的杯子」容量 + 界面主题。
 *
 * 为什么单独一个键，而不是塞进 HealthProfile：
 * 1) 喝水卡在没填健康档案时也在用，杯子是"我怎么喝"的偏好，不该被档案表单的必填校验绑架；
 * 2) 不动 HealthProfile 的结构，saveHealthProfile 的调用点就不用逐个补字段
 *    （漏一个字段就会把老用户的值写成 undefined）。
 *
 * 键在 `recipe.` 前缀下 → 自动纳入备份导出/导入/清空。
 */

/** 界面主题：跟随系统 / 浅色 / 深色 */
export type ThemeChoice = "system" | "light" | "dark";

export type AppPrefs = {
  /** 我的杯子容量（ml）：喝水按「杯」录入时用它换算与快选；存储永远是 ml */
  cupMl: number;
  /** 界面主题（见 app/lib/theme.ts）；老数据里没有这个字段 → 跟随系统 */
  theme: ThemeChoice;
};

const KEY = "recipe.prefs.v1";

export const DEFAULT_PREFS: AppPrefs = { cupMl: DEFAULT_CUP_ML, theme: "system" };

function normalizeTheme(v: unknown): ThemeChoice {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** 读取偏好：读不到 / 坏数据 / 越界值都归一成合法值，绝不返回 NaN */
export function loadPrefs(): AppPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AppPrefs> | null;
    return { cupMl: clampCupMl(parsed?.cupMl ?? DEFAULT_CUP_ML), theme: normalizeTheme(parsed?.theme) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** 合并写回，返回归一化后的完整偏好（调用方直接用它 setState 即可） */
export function savePrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next: AppPrefs = { ...loadPrefs(), ...patch };
  next.cupMl = clampCupMl(next.cupMl);
  next.theme = normalizeTheme(next.theme);
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
