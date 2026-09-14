import type { NextConfig } from "next";

/**
 * 纯前端版本：所有数据存在浏览器 localStorage，AI 由浏览器直连 DeepSeek。
 * 因此可以完整静态导出（out/），直接丢到任意静态托管 / 手机上访问，无需服务器。
 *
 * 部署到子路径时（如 GitHub Pages 的 /repo-name/）设置环境变量 BASE_PATH。
 */
const basePath = process.env.BASE_PATH || "";

// 构建版本号：写进代码里，显示在设置页。
// 用途是排查"手机上到底跑的哪一版"——不必再靠功能猜。
const buildStamp = new Date().toISOString().slice(0, 16).replace("T", " ");

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // 客户端（Service Worker 注册、manifest 路径）也要知道子路径与构建版本
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_BUILD_STAMP: buildStamp },
  // 静态导出下没有服务端，未优化的图片组件需要显式关闭
  images: { unoptimized: true },
  // 导出为 /path/index.html，静态托管能直接命中
  trailingSlash: true,
};

export default nextConfig;
