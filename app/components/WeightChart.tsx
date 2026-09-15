"use client";

import { motion, useReducedMotion } from "motion/react";
import type { WeightEntry } from "../lib/types";
import { weightRange } from "../lib/weight";

/**
 * 体重趋势折线图（纯 SVG，不引图表库）。
 * 只画最近 N 条记录，避免长期数据把曲线压平。
 */
export function WeightChart({ entries, maxPoints = 30 }: { entries: WeightEntry[]; maxPoints?: number }) {
  const reduced = useReducedMotion();

  // 只取最近 maxPoints 条
  const data = entries.slice(-maxPoints);

  if (data.length < 2) {
    return (
      <div
        className="flex h-28 items-center justify-center rounded-2xl text-[12px] leading-5"
        style={{ background: "var(--heal-blue-50)", color: "var(--heal-muted)" }}
      >
        记满两天就能看到趋势曲线
      </div>
    );
  }

  const W = 320;
  const H = 110;
  const padX = 6;
  const padTop = 10;
  const padBottom = 18;

  const { min, max } = weightRange(data);
  const span = max - min || 1;

  const x = (i: number) => padX + (i / (data.length - 1)) * (W - padX * 2);
  const y = (kg: number) => padTop + (1 - (kg - min) / span) * (H - padTop - padBottom);

  const points = data.map((e, i) => `${x(i).toFixed(1)},${y(e.weightKg).toFixed(1)}`).join(" ");
  // 折线下方的渐变填充
  const area = `${padX},${H - padBottom} ${points} ${W - padX},${H - padBottom}`;

  const first = data[0];
  const last = data[data.length - 1];

  return (
    <div className="rounded-2xl p-2" style={{ background: "var(--heal-blue-50)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="体重趋势图">
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--heal-amber-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--heal-amber-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 最高/最低参考线 */}
        {[
          { v: max, label: `${max.toFixed(1)}` },
          { v: min, label: `${min.toFixed(1)}` },
        ].map((g) => (
          <g key={g.label}>
            <line
              x1={padX}
              x2={W - padX}
              y1={y(g.v)}
              y2={y(g.v)}
              stroke="var(--heal-card-border)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
            <text x={padX} y={y(g.v) - 3} fontSize="9" fill="var(--heal-muted)">
              {g.label}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#weightFill)" />

        <motion.polyline
          points={points}
          fill="none"
          stroke="var(--heal-amber-deep)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0.4 }}
          animate={reduced ? {} : { pathLength: 1, opacity: 1 }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.7, ease: "easeOut" }}
        />

        {/* 数据点：只标最后一个，避免密集 */}
        <circle cx={x(data.length - 1)} cy={y(last.weightKg)} r="3.5" fill="var(--heal-amber-deep)" />

        {/* 首尾日期 */}
        <text x={padX} y={H - 5} fontSize="9" fill="var(--heal-muted)">
          {first.date.slice(5)}
        </text>
        <text x={W - padX} y={H - 5} fontSize="9" fill="var(--heal-muted)" textAnchor="end">
          {last.date.slice(5)}
        </text>
      </svg>
    </div>
  );
}
