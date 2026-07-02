import type { Metadata } from "next";
import "./globals.css";
import { AppInit } from "./components/AppInit";

export const metadata: Metadata = {
  title: "今天吃什么呀",
  description: "AI 智能食谱推荐 · 治愈系饮食助手",
  manifest: "/manifest.json",
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
