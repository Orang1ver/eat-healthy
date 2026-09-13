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
