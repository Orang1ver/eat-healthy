/**
 * 步数来源。
 *
 * 目前只支持手动录入。之所以单独抽出这个模块，是因为"自动读步数"在本项目的
 * 架构下没有可行路径，将来若真要接，改动集中在这里：
 *
 * - 微信运动：`wx.getWeRunData` 只在微信小程序内可用，H5/网页调不到，
 *   且返回加密数据必须由后端解密。故不可行，除非把整个应用改成小程序。
 * - 华为手表：Health Kit 有 Cloud REST API（支持非华为/苹果手机），
 *   但需要华为开发者账号、申请"日常活动数据"权限并审核通过，
 *   且换 token 需要 client_secret，必须放在后端 —— 与"纯前端、数据不出本地"冲突。
 * - 小米手环：无面向第三方的官方开放 API，数据只进 Zepp Life / 小米运动健康。
 * - 通用系统接口：iOS 用 HealthKit、Android 用 Health Connect，两者都只能在
 *   原生 App 内调用；且 iOS 上已装到主屏的 Web App 与 Safari 的存储互相隔离
 *   （Apple 明确设计如此），所以也无法用"快捷指令打开链接写入"的方式绕过。
 *
 * 结论：网页架构下只能手动。若将来做原生 App，在下面实现 fetchStepsFromSource 即可。
 */
export type StepSource = "manual";

/** 当前生效的步数来源 */
export const CURRENT_STEP_SOURCE: StepSource = "manual";

export const STEP_SOURCE_LABEL: Record<StepSource, string> = {
  manual: "手动录入",
};

/**
 * 将来接原生健康数据时在这里实现（保留签名，便于替换）。
 * 现在固定返回 null，表示"没有自动来源，需要用户手动填"。
 */
export async function fetchStepsFromSource(): Promise<number | null> {
  return null;
}

/** 步数快选档位 */
export const STEP_PRESETS = [1000, 3000, 5000];

/** 手动录入的合理上限（超过多半是误输） */
export const STEP_MAX = 100000;

export function clampSteps(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(STEP_MAX, Math.max(0, Math.round(n)));
}

/** 一步约 0.7 米，用于给用户一个直观的距离感受 */
export function stepsToKm(steps: number): number {
  return Math.round((steps * 0.7) / 100) / 10;
}

// ---------- 喝水 ----------

/**
 * 喝水按「杯」录入，但**一杯是多少由用户自己定**：一次性纸杯约 200ml、家用玻璃杯
 * 250~300ml、保温杯 400~500ml、矿泉水瓶 500ml 上下 —— 写死一个值总有人对不上，
 * 于是"＋1 杯"记的其实是错的量。
 *
 * 约定：**ml 是唯一的存储单位**（DailyCheckin.waterMl），「杯」只是显示与快捷按钮的
 * 换算层。所以换杯子只影响换算与按钮，不会改动任何已记录的水量，也就不需要数据迁移。
 */
export const DEFAULT_CUP_ML = 250;

/** 杯容量快选档位（覆盖纸杯 / 玻璃杯 / 保温杯 / 水瓶） */
export const CUP_PRESETS = [150, 200, 250, 300, 400, 500];

export const CUP_MIN = 100;
export const CUP_MAX = 1000;

/** 归一化杯容量：非法值回落到默认，夹在 100~1000，取整到 10ml */
export function clampCupMl(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CUP_ML;
  return Math.round(Math.min(CUP_MAX, Math.max(CUP_MIN, n)) / 10) * 10;
}

/** 把毫升换算成"几杯"，用于比 ml 更直观的提示 */
export function mlToCups(ml: number, cupMl: number = DEFAULT_CUP_ML): number {
  return Math.round((ml / clampCupMl(cupMl)) * 10) / 10;
}

/** 几杯换算成毫升（快捷按钮用） */
export function cupsToMl(cups: number, cupMl: number): number {
  return Math.max(0, Math.round(cups * clampCupMl(cupMl)));
}

/** 还差几杯：向上取整（杯是整数才好使），已经喝够则为 0 */
export function cupsRemaining(remainingMl: number, cupMl: number): number {
  if (remainingMl <= 0) return 0;
  return Math.ceil(remainingMl / clampCupMl(cupMl));
}

// ---------- 进度文案 ----------

export type Progress = {
  current: number;
  target: number;
  pct: number;
  remaining: number;
  done: boolean;
};

export function progressOf(current: number, target: number): Progress {
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.min(100, Math.round((current / safeTarget) * 100));
  const remaining = Math.max(0, target - current);
  return { current, target, pct, remaining, done: current >= target };
}

/**
 * 喝水的进度文案，例如「还差 301ml（约 2 杯）」。
 *
 * 为什么把 ml 放前面：杯数向上取整，200ml 的杯子"2 杯"是 400ml，
 * 写成「还差 2 杯（约 301ml）」自己跟自己打架。ml 是实际要喝的量，杯只是直观参考。
 */
export function waterProgressText(progress: Progress, cupMl: number = DEFAULT_CUP_ML): string {
  if (progress.done) return "今天喝够啦 🎉";
  return `还差 ${progress.remaining} ml（约 ${cupsRemaining(progress.remaining, cupMl)} 杯）`;
}

/** 步数的进度文案，例如「还差 1500 步（约 1.1km）」 */
export function stepsProgressText(progress: Progress): string {
  if (progress.done) return "今天走够啦 🎉";
  return `还差 ${progress.remaining} 步（约 ${stepsToKm(progress.remaining)}km）`;
}
