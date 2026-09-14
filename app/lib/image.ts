/**
 * 截图预处理：把长图切成若干段，再交给视觉模型。
 *
 * 为什么要切而不是"缩小"：
 * DeepSeek 视觉接口对图片有两条硬限制（见官方《图像理解》文档）：
 *   1. 单边最长 8192 像素（一次请求含 15 张以上图片时降为 4096）
 *   2. 单张最大 32 MiB，请求体 48 MiB
 * 而且进模型前每张图都会被自动等比缩放，缩小后总像素约相当于 1300×1300。
 *
 * 于是长图（手机截图宽约 1080，把整个菜单页截成一张）会有两个问题：
 *   - 单边动辄上万像素 → 直接被拒（用户看到的 "unsupported image" 就是这个）
 *   - 就算不超限，等比压扁后文字只剩三分之一高 → 菜名糊掉、识别大面积漏菜
 * 所以正确做法是按"总像素 + 单边"切成多段分别发送：每段都落在自动缩放阈值内，
 * 文字基本保持原分辨率，识别率远高于压扁整张。
 */

/**
 * 每段总像素上限。
 * 取 170 万 ≈ 模型自动缩放的目标（文档：缩小后总像素约相当于 1300×1300 ≈ 169 万）。
 * 控制在目标之内，图片进模型时就**不会被二次缩小**，文字保持原分辨率——
 * 这对菜单这类密集小字是关键。
 */
export const MAX_SLICE_PIXELS = 1_700_000;
/** 每段单边上限（一次请求图片较多时接口会降到 4096，这里直接按 4096 控） */
export const MAX_SLICE_EDGE = 4096;
/**
 * 一张图最多切几段。
 * 取 20：像 1080×26092（外卖菜单长截图的极端情况）这样的图，
 * 保持原分辨率需要约 18 段；上限太小就会触发"整体缩小"，反而牺牲清晰度。
 * 20 段 ≈ 20×384 token，请求体仍在 48MiB 内（单边 4096 的限制要求 <15 张，
 * 而我们的段单边约 1600，安全）。
 */
export const MAX_SLICES = 20;
/** 相邻段的重叠像素：防止正好把一行菜名拦腰切断 */
export const SLICE_OVERLAP = 80;
/** 缩放后宽度上限（与旧实现一致：不放大，只把过宽的图缩到这个宽度） */
export const MAX_WIDTH = 1600;

/** JPEG 质量候选：先 0.85，太大就降质，保证单段体积可控 */
const QUALITY_STEPS = [0.85, 0.7, 0.6];
/** 单段 dataURL 的目标字节上限（base64 字符串长度），约 1.6MB 原图 */
const MAX_DATAURL_CHARS = 2_200_000;

/** 计算每段的高度（同时满足像素与单边约束，且不超过 4096） */
function sliceHeightFor(width: number): number {
  const byPixels = Math.floor(MAX_SLICE_PIXELS / width);
  return Math.max(200, Math.min(MAX_SLICE_EDGE, byPixels));
}

function toDataUrl(canvas: HTMLCanvasElement): string {
  for (const q of QUALITY_STEPS) {
    const url = canvas.toDataURL("image/jpeg", q);
    // canvas 面积越限时浏览器会静默返回 "data:,"（空图）——必须挡住，
    // 否则会把空图发给接口，用户看到的就是"图片格式不支持"这种误导性报错。
    if (!url.startsWith("data:image/")) {
      throw new Error("图片太大，浏览器无法处理。请改成截取菜单的一部分，或分成几张截图。");
    }
    if (url.length <= MAX_DATAURL_CHARS || q === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
      return url;
    }
  }
  /* istanbul ignore next */
  throw new Error("图片处理失败，换一张试试");
}

/**
 * 读文件 → 按需切段 → 返回 dataURL 列表。
 * 普通截图只返回 1 个；长图返回多段（顺序是从上到下）。
 */
export async function fileToDataUrls(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file);

  // 只缩不放：宽度超过 MAX_WIDTH 才缩放
  let scale = Math.min(1, MAX_WIDTH / bitmap.width);
  let width = Math.max(1, Math.round(bitmap.width * scale));
  let height = Math.max(1, Math.round(bitmap.height * scale));

  // 切段数 ≈ 总像素 / 每段像素，**与缩放比例无关**。
  // 所以"极长的图"如果照原尺寸切，段数会超过 MAX_SLICES，被截断后**下半部分会被静默丢掉**
  // （菜单下半截的菜全没了）。宁可整体缩小、略微降低清晰度，也必须保证完整覆盖。
  const neededSlices = (w: number, h: number) => {
    const sh = sliceHeightFor(w);
    return Math.ceil((h - SLICE_OVERLAP) / Math.max(1, sh - SLICE_OVERLAP));
  };
  if (neededSlices(width, height) > MAX_SLICES) {
    // 目标：总像素压到 MAX_SLICES 段以内，留 8% 余量抵消重叠带来的段数上浮
    const k = Math.sqrt((MAX_SLICES * MAX_SLICE_PIXELS * 0.92) / (width * height));
    scale *= Math.min(1, k);
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));
  }

  const sliceH = sliceHeightFor(width);
  if (height <= sliceH) {
    // 普通图：不切，走原来的单图路径
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    return [toDataUrl(canvas)];
  }

  // 需要切段：按 sliceH 自上而下切，相邻段重叠 SLICE_OVERLAP
  const step = Math.max(1, sliceH - SLICE_OVERLAP);
  const total = Math.min(MAX_SLICES, Math.ceil((height - SLICE_OVERLAP) / step));

  const urls: string[] = [];
  for (let i = 0; i < total; i++) {
    const top = i * step;
    const h = Math.min(sliceH, height - top);
    if (h <= 0) break;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    // 从原图按对应比例取这一段（scale 已把原图尺寸映射到 width×height）
    ctx.drawImage(bitmap, 0, Math.round(top / scale), bitmap.width, Math.round(h / scale), 0, 0, width, h);
    urls.push(toDataUrl(canvas));
  }
  return urls;
}
