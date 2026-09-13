"use client";

import { loadApiKeys } from "./apiKeys";

/**
 * 纯前端直连 DeepSeek API（官方支持浏览器 CORS）。
 * 文本用 deepseek-chat；视觉（V4.1 Flash 起）用 deepseek-flash，同 Key 同地址。
 */
const BASE_URL = "https://api.deepseek.com";
export const TEXT_MODEL = process.env.NEXT_PUBLIC_DEEPSEEK_MODEL || "deepseek-chat";
export const VISION_MODEL = process.env.NEXT_PUBLIC_DEEPSEEK_VISION_MODEL || "deepseek-flash";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type Content = string | (TextPart | ImagePart)[];

function requireKey(): string {
  const key = loadApiKeys().deepseekKey?.trim();
  if (!key) throw new Error("请先在首页右上角 ⚙️ 设置里填入 DeepSeek API Key");
  return key;
}

async function chat(model: string, content: Content, opts: { temperature?: number; json?: boolean } = {}): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireKey()}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: opts.temperature ?? 0.5,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.message || "";
    } catch {
      /* 忽略解析失败 */
    }
    if (res.status === 401) throw new Error("DeepSeek Key 无效，请在 ⚙️ 设置里检查");
    throw new Error(detail || `DeepSeek 请求失败（${res.status}）`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** 文本对话，要求返回 JSON */
export async function chatJSON<T>(prompt: string, temperature = 0.5): Promise<T> {
  const raw = await chat(TEXT_MODEL, prompt, { temperature, json: true });
  return JSON.parse(raw) as T;
}

/** 文本对话，返回纯文本 */
export async function chatText(prompt: string, temperature = 0.5): Promise<string> {
  return chat(TEXT_MODEL, prompt, { temperature });
}

/** 视觉对话（截图识别），要求返回 JSON；images 为 dataURL 数组 */
export async function visionJSON<T>(prompt: string, images: string[]): Promise<T> {
  const content: (TextPart | ImagePart)[] = images.map((url) => ({ type: "image_url", image_url: { url } }));
  content.push({ type: "text", text: prompt });
  const raw = await chat(VISION_MODEL, content, { temperature: 0.1 });
  return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
}
