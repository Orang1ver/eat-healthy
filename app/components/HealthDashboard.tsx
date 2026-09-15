"use client";

import { useEffect, useState } from "react";
import { ProgressRing } from "./ProgressRing";
import { getRecentCheckins, loadCheckin, loadHealthProfile, loadRewards, loadWeights } from "../lib/storage";
import { calcDailyTargets, type DailyHealthTargets } from "../lib/health";
import { BADGES, calcCurrentStreak, calcMaxStreak } from "../lib/rewards";
import { cupsRemaining, progressOf, stepsToKm, type Progress } from "../lib/steps";
import { deltaColor, deltaText, deltaVsPrevious, round1, sortWeights } from "../lib/weight";
import { addDays, todayISO, WEEKDAY_LABELS } from "../lib/date";
import { loadPrefs } from "../lib/prefs";

/**
 * 健康仪表盘：进度环（喝水 / 步数）+ 最近 7 天趋势条 + 体重迷你曲线 + 连续与徽章。
 *
 * 三个刻意的选择：
 * 1) **纯 SVG / div 手写**，不引图表库 —— 与 `WeightChart` 同一思路，为一个环装
 *    recharts 不值得；进度环的动画用 CSS transition，连 motion 都不引（首页是入口页）。
 * 2) **数据自己读**（照 WeightCard / ExerciseCard 的写法）：父组件只在写入后把
 *    `reloadKey` 加一，不必把 profile/打卡/奖励/体重一路透传进来。
 * 3) 读数据放在 effect 里而不是 useState 初始化函数：服务端预渲染时没有 window，
 *    直接同步读会让首屏 HTML 与 hydration 不一致。
 */
export function HealthDashboard({ reloadKey = 0, compact = false }: { reloadKey?: number; compact?: boolean }) {
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    setData(buildData());
  }, [reloadKey]);

  if (!data) return null;
  const wp = data.waterProgress;
  const sp = data.stepsProgress;

  return (
    <div className="heal-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">📊 今天</span>
        <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
          最近 {DASH_DAYS} 天记录 {data.loggedDays} 天 · 达标 {data.hitDays} 天
        </span>
      </div>

      {/* 两个进度环：喝水 / 步数 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center">
          <ProgressRing pct={wp.pct} done={wp.done} ariaLabel={`喝水已完成 ${wp.pct}%`}>
            <span className="text-xl font-medium" style={{ color: wp.done ? "var(--heal-blue-text)" : "var(--heal-amber-deep)" }}>
              {wp.pct}
              <span className="text-[10px]">%</span>
            </span>
            <span className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
              💧 喝水
            </span>
          </ProgressRing>
          <div className="mt-1.5 text-center text-[11px]">
            <b>{data.water}</b>
            <span style={{ color: "var(--heal-muted)" }}> / {data.targets.waterTarget} ml</span>
          </div>
          <div className="text-center text-[10px]" style={{ color: wp.done ? "var(--heal-blue-text)" : "var(--heal-muted)" }}>
            {wp.done ? "喝够啦 🎉" : `还差 ${wp.remaining}ml（约 ${cupsRemaining(wp.remaining, data.cupMl)} 杯）`}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <ProgressRing pct={sp.pct} done={sp.done} ariaLabel={`步数已完成 ${sp.pct}%`}>
            <span className="text-xl font-medium" style={{ color: sp.done ? "var(--heal-blue-text)" : "var(--heal-amber-deep)" }}>
              {sp.pct}
              <span className="text-[10px]">%</span>
            </span>
            <span className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
              🚶 步数
            </span>
          </ProgressRing>
          <div className="mt-1.5 text-center text-[11px]">
            <b>{data.steps}</b>
            <span style={{ color: "var(--heal-muted)" }}> / {data.targets.stepsTarget} 步</span>
          </div>
          <div className="text-center text-[10px]" style={{ color: sp.done ? "var(--heal-blue-text)" : "var(--heal-muted)" }}>
            {sp.done ? "走够啦 🎉" : `还差 ${sp.remaining} 步（约 ${stepsToKm(sp.remaining)}km）`}
          </div>
        </div>
      </div>

      {compact ? (
        /* 紧凑版（首页）：环 + 一行关键数字，不占整屏 */
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--heal-muted)" }}>
          <span>
            ⚖️ <b style={{ color: "var(--heal-amber-deep)" }}>{data.weightKg != null ? data.weightKg.toFixed(1) : "—"}</b> kg
            {data.weightDelta != null && <span style={{ color: deltaColor(data.weightDelta) }}> {deltaText(data.weightDelta)}</span>}
          </span>
          <span>
            🔥 连续 <b style={{ color: "var(--heal-amber-deep)" }}>{data.streak}</b> 天（最长 {data.maxStreak}）
          </span>
          {data.ownedBadges.length > 0 && <span>{data.ownedBadges.slice(-3).map((b) => b.emoji).join(" ")}</span>}
        </div>
      ) : (
        <>
          {/* 最近 7 天：两排柱子，每根的高度 = 当天 / 目标 */}
          <div className="mt-4 rounded-2xl p-2.5" style={{ background: "var(--heal-blue-50)" }}>
            <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: "var(--heal-muted)" }}>
              <span>最近 7 天</span>
              <span>
                日均 喝水 {data.avgWater}ml · 步数 {data.avgSteps}
              </span>
            </div>
            {[
              { key: "water" as const, emoji: "💧", label: "喝水" },
              { key: "steps" as const, emoji: "🚶", label: "步数" },
            ].map((row) => (
              <div key={row.key} className="mb-2 last:mb-0">
                <div className="mb-1 text-[10px]" style={{ color: "var(--heal-muted)" }}>
                  {row.emoji} {row.label}
                </div>
                <div className="flex items-end gap-1">
                  {data.days.map((d) => {
                    const pct = row.key === "water" ? d.waterPct : d.stepsPct;
                    const hit = row.key === "water" ? d.waterHit : d.stepsHit;
                    return (
                      <div key={row.key + d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.date} ${row.label}`}>
                        <div className="flex h-9 w-full items-end overflow-hidden rounded-md" style={{ background: "var(--heal-card-bg)" }}>
                          <div
                            className="w-full rounded-md transition-all"
                            style={{ height: `${pct}%`, background: hit ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)" }}
                          />
                        </div>
                        <span className="text-[9px]" style={{ color: "var(--heal-muted)" }}>
                          {d.dow.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 体重：最新值 + 差值 + 迷你曲线（详细曲线仍在下面的体重卡里） */}
          <div className="mt-2.5 flex items-center gap-3 rounded-2xl p-2.5" style={{ background: "var(--heal-amber-50)" }}>
            <div className="shrink-0">
              <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                ⚖️ 体重{data.weightDate ? ` ${data.weightDate.slice(5)}` : ""}
              </div>
              <div className="text-lg font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                {data.weightKg != null ? data.weightKg.toFixed(1) : "—"}
                <span className="text-[10px]"> kg</span>
              </div>
              <div className="text-[10px]" style={{ color: data.weightDelta != null ? deltaColor(data.weightDelta) : "var(--heal-muted)" }}>
                {data.weightDelta != null ? `较上次 ${deltaText(data.weightDelta)}` : "只有一条记录"}
              </div>
            </div>
            {data.weightSeries.length >= 2 ? (
              <svg viewBox="0 0 120 40" className="h-10 min-w-0 flex-1" role="img" aria-label="体重迷你趋势">
                <polyline
                  points={sparkPoints(data.weightSeries, 116, 32)}
                  fill="none"
                  stroke="var(--heal-amber-deep)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="translate(2,4)"
                />
              </svg>
            ) : (
              <p className="min-w-0 flex-1 text-[10px]" style={{ color: "var(--heal-muted)" }}>
                记满两天就有趋势线
              </p>
            )}
          </div>

          {/* 坚持与徽章 */}
          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
            <span style={{ color: "var(--heal-muted)" }}>
              🔥 连续 <b style={{ color: "var(--heal-amber-deep)" }}>{data.streak}</b> 天 · 历史最长 {data.maxStreak} 天
            </span>
            <span className="flex items-center gap-1">
              {data.ownedBadges.length > 0 ? (
                data.ownedBadges.map((b) => (
                  <span key={b.id} title={b.label}>
                    {b.emoji}
                  </span>
                ))
              ) : (
                <span style={{ color: "var(--heal-muted)" }}>还没有徽章</span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const DASH_DAYS = 7;

type DashDay = {
  date: string;
  /** "周一" */
  dow: string;
  waterMl: number;
  steps: number;
  waterPct: number;
  stepsPct: number;
  waterHit: boolean;
  stepsHit: boolean;
};

type DashData = {
  targets: DailyHealthTargets;
  cupMl: number;
  water: number;
  steps: number;
  waterProgress: Progress;
  stepsProgress: Progress;
  /** 最近 7 天（含今天），没有记录的那天也占位 */
  days: DashDay[];
  loggedDays: number;
  hitDays: number;
  avgWater: number;
  avgSteps: number;
  weightKg: number | null;
  weightDelta: number | null;
  weightDate: string | null;
  /** 迷你曲线用的数值（最多 30 个点） */
  weightSeries: number[];
  streak: number;
  maxStreak: number;
  ownedBadges: { id: string; emoji: string; label: string }[];
};

/** 柱子高度百分比：至少留 4% 让"那天确实没记"也看得见，最高 100% */
function barPct(value: number, target: number): number {
  if (value <= 0 || target <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((value / target) * 100)));
}

/** 把一串数值压成迷你折线的点串（放进 w×h 的框，值大的在上） */
function sparkPoints(values: number[], w: number, h: number): string {
  if (values.length === 0) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - ((v - lo) / span) * h;
      return `${round1(x)},${round1(y)}`;
    })
    .join(" ");
}

/** 从 localStorage 现算一份仪表盘数据；没有健康档案时返回 null（页面自己给引导） */
function buildData(): DashData | null {
  const profile = loadHealthProfile();
  if (!profile) return null;

  const targets = calcDailyTargets(profile);
  const today = todayISO();
  const checkin = loadCheckin(today);
  const water = checkin?.waterMl ?? 0;
  const steps = checkin?.steps ?? 0;
  const rewards = loadRewards();
  const weightsMap = loadWeights();
  const weights = sortWeights(weightsMap);
  const latest = weights.length ? weights[weights.length - 1] : null;
  const dPrev = deltaVsPrevious(weightsMap);

  // 最近 7 天：缺的那天补 0，否则柱子会错位
  const byDate = new Map(getRecentCheckins(DASH_DAYS, today).map((c) => [c.date, c]));
  const days: DashDay[] = Array.from({ length: DASH_DAYS }, (_, i) => addDays(today, i - (DASH_DAYS - 1))).map((date) => {
    const c = byDate.get(date);
    const w = c?.waterMl ?? 0;
    const s = c?.steps ?? 0;
    return {
      date,
      dow: WEEKDAY_LABELS[(new Date(date + "T00:00:00").getDay() + 6) % 7],
      waterMl: w,
      steps: s,
      waterPct: barPct(w, targets.waterTarget),
      stepsPct: barPct(s, targets.stepsTarget),
      waterHit: w >= targets.waterTarget,
      stepsHit: s >= targets.stepsTarget,
    };
  });
  const logged = days.filter((d) => d.waterMl > 0 || d.steps > 0);
  const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0);

  return {
    targets,
    cupMl: loadPrefs().cupMl,
    water,
    steps,
    waterProgress: progressOf(water, targets.waterTarget),
    stepsProgress: progressOf(steps, targets.stepsTarget),
    days,
    loggedDays: logged.length,
    hitDays: days.filter((d) => d.waterHit && d.stepsHit).length,
    avgWater: avg(logged.map((d) => d.waterMl)),
    avgSteps: avg(logged.map((d) => d.steps)),
    weightKg: latest?.weightKg ?? profile.weightKg ?? null,
    weightDelta: dPrev?.diff ?? null,
    weightDate: latest?.date ?? null,
    weightSeries: weights.slice(-30).map((w) => w.weightKg),
    streak: calcCurrentStreak(rewards.days, today),
    maxStreak: calcMaxStreak(rewards.days),
    ownedBadges: BADGES.filter((b) => rewards.badges[b.id]).map((b) => ({ id: b.id, emoji: b.emoji, label: b.label })),
  };
}
