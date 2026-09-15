"use client";

import type { ReactNode } from "react";

/**
 * 进度环（纯 SVG，不引图表库 —— 与 WeightChart 同一个思路）。
 * 中心放关键数字，环上按百分比填充，达标用蓝色、未达标用琥珀色。
 *
 * 动效刻意用 CSS transition 而不是 motion：首页是入口页，为了一个环把 motion
 * 打进首页包体不划算；而且 CSS transition 只在数值变化时生效（首次渲染不闪），
 * 之后加一杯水/走一段路，环会平滑追上去。motion-reduce 下自动去掉过渡。
 */
export function ProgressRing({
  pct,
  done,
  size = 96,
  stroke = 9,
  children,
  ariaLabel,
}: {
  /** 0~100，超过按 100 画 */
  pct: number;
  /** 是否已达标（决定颜色） */
  done: boolean;
  size?: number;
  stroke?: number;
  /** 环中央的内容（一般是大字号数值 + 小字单位） */
  children: ReactNode;
  ariaLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={ariaLabel ?? `完成 ${clamped}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--heal-blue-50)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">{children}</div>
    </div>
  );
}
