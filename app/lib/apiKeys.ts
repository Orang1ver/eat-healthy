export type ApiKeys = {
  deepseekKey?: string;
};

const KEY = "recipe.apikeys.v1";

export function loadApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ApiKeys) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(keys));
}

/** 附加到 fetch() 请求头，让 API 路由优先使用用户在设置里填的 key */
export function apiKeyHeaders(): Record<string, string> {
  const keys = loadApiKeys();
  const headers: Record<string, string> = {};
  if (keys.deepseekKey) headers["x-deepseek-key"] = keys.deepseekKey;
  return headers;
}
