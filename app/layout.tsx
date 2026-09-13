import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppInit } from "./components/AppInit";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "今天吃什么呀",
  description: "AI 智能食谱推荐 · 健康饮食助手",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "今天吃什么" },
  icons: {
    icon: `${basePath}/icons/icon-192.png`,
    apple: `${basePath}/icons/icon-192.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAC775",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppInit />
        {children}
      </body>
    </html>
  );
}
