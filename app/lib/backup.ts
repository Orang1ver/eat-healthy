"use client";

import { loadApiKeys, saveApiKeys, type ApiKeys } from "./apiKeys";

/** 本应用所有 localStorage 键的统一前缀 */
const PREFIX = "recipe.";
const API_KEY_STORAGE = "recipe.apikeys.v1";

export type Backup = {
  app: "今天吃什么呀";
  version: 1;
  exportedAt: string;
  /** 是否包含 DeepSeek Key（分享给别人时注意） */
  includesApiKey: boolean;
  data: Record<string, string>;
};

/** 把本应用的全部本地数据导出成可读 JSON */
export function exportBackup(includeApiKey: boolean): Backup {
  const data: Record<string, string> = {};
  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      if (!includeApiKey && k === API_KEY_STORAGE) continue;
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    }
  }
  return {
    app: "今天吃什么呀",
    version: 1,
    exportedAt: new Date().toISOString(),
    includesApiKey: includeApiKey,
    data,
  };
}

/** 导出为缩进 JSON 文本 */
export function backupToText(includeApiKey: boolean): string {
  return JSON.stringify(exportBackup(includeApiKey), null, 2);
}

/** 触发浏览器下载一个 .json 备份文件 */
export function downloadBackup(includeApiKey: boolean) {
  const blob = new Blob([backupToText(includeApiKey)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  a.href = url;
  a.download = `今天吃什么呀-备份-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 从备份文本恢复数据。默认合并不覆盖（导入他人配置时不该丢掉自己的记录），
 * overwrite=true 时整份替换。
 */
export function importBackup(text: string, overwrite = false): { keys: number } {
  let parsed: Backup;
  try {
    parsed = JSON.parse(text) as Backup;
  } catch {
    throw new Error("这段内容不是有效的备份 JSON");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("备份格式不对，缺少 data 字段");
  }

  const entries = Object.entries(parsed.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === "string");
  if (entries.length === 0) throw new Error("备份里没有可恢复的数据");

  let count = 0;
  for (const [k, v] of entries) {
    if (!overwrite) {
      const existing = localStorage.getItem(k);
      // 已有数据时，只有键完全不存在才写入，避免覆盖自己正在用的记录
      if (existing !== null) continue;
    }
    localStorage.setItem(k, v);
    count++;
  }
  return { keys: count };
}

/** 清空本应用的全部本地数据（危险操作） */
export function clearAllData() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** 备份里有哪些内容，用于导入前预览提示 */
export function describeBackup(text: string): string {
  const parsed = JSON.parse(text) as Backup;
  const keys = Object.keys(parsed.data || {});
  const has = (s: string) => keys.some((k) => k.includes(s));
  const parts: string[] = [];
  if (has("healthProfile")) parts.push("健康档案");
  if (has("dailyCheckins")) parts.push("打卡记录");
  if (has("rewards")) parts.push("打卡奖励");
  if (has("weights")) parts.push("体重记录");
  if (has("exercise")) parts.push("运动记录");
  if (has("mealRecords")) parts.push("饮食记录");
  if (has("takeoutMock")) parts.push("菜单库");
  if (has("apikeys")) parts.push("API Key");
  if (has("userProfile")) parts.push("饮食偏好笔记");
  return parts.length ? parts.join("、") : `${keys.length} 项数据`;
}

export type { ApiKeys };
export { loadApiKeys, saveApiKeys };
