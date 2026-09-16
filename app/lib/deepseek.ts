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

/**
 * 网络层失败（DNS 解析不了 / 连不上 / 被代理或插件拦了 / 设备离线）时，浏览器抛的是 TypeError：
 * Chrome 说 "Failed to fetch"、Safari 说 "Load failed"、Firefox 说 "NetworkError…"。
 * 这些说法用户看不懂，也分不清"是我没网"还是"Key 填错了" —— 而这两种情况该做的事完全不同，
 * 所以统一翻成一句能照做的话，并给一条自查路径（去首页点一次生成推荐，就知道是不是全断了）。
 *
 * ⚠️ 只在**网络层**失败时替换；接口返回的 4xx/5xx 走下面原有的错误翻译，不要覆盖。
 */
function friendlyFetchError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|load failed|networkerror|network request failed|fetch failed|err_/i.test(raw)) {
    return new Error(
      `网络请求发不出去（浏览器报「${raw}」）：这台设备没连上 api.deepseek.com。` +
        "常见原因：① 当前网络不通 —— 换个 Wi-Fi 或用手机流量再试；" +
        "② 开着 Steam++ / Watt Toolkit 之类的网络加速或代理 —— 关掉加速再试；" +
        "③ 浏览器插件或防火墙把它拦了。" +
        "想确认是不是所有 AI 功能都断了：去首页点一次「✨ 生成推荐」。",
    );
  }
  return e instanceof Error ? e : new Error(raw);
}

async function chat(model: string, content: Content, opts: { temperature?: number; json?: boolean } = {}): Promise<string> {
  const key = requireKey(); // 先查 Key：没填 Key 时不该伪装成网络问题
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: opts.temperature ?? 0.5,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    throw friendlyFetchError(e);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.message || "";
    } catch {
      /* 忽略解析失败 */
    }
    if (res.status === 401) throw new Error("DeepSeek Key 无效，请在 ⚙️ 设置里检查");

    // 把接口的英文报错翻成能照做的中文提示。
    // 图片相关的报错文案容易误导：它说"格式不支持"，实际常见原因是尺寸/体积超限
    // （长截图单边超过 8192 像素就会被这样拒绝），所以提示要指向真正该做的事。
    const lower = detail.toLowerCase();
    if (lower.includes("unsupported image") || lower.includes("does not support image") || lower.includes("invalid image")) {
      throw new Error(
        "图片被接口拒绝了。常见原因是截图太长或图片过大 —— 请把这张图截成 2~3 段分别上传，或只截菜单的一部分。",
      );
    }
    if (res.status === 413 || lower.includes("too large") || lower.includes("entity too large")) {
      throw new Error("图片总量太大，请减少张数，或分成几次导入。");
    }
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
