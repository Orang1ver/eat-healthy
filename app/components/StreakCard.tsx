"use client";

import { todayISO, WEEKDAY_LABELS, weekDates } from "../lib/date";
import type { DailyHealthTargets } from "../lib/health";
import { BADGES, calcCurrentStreak, calcMaxStreak, evaluateCheckin, nextBadge, type Badge } from "../lib/rewards";
import type { DailyCheckin, RewardState } from "../lib/types";

/**
 * 「坚持」卡：原来的「🔥 连续打卡」+「📊 本周打卡」合成一张。
 *
 * 为什么合并：两张卡讲的是同一件事 —— 每天喝够水、走够步才算 1 天。
 * 上面给数字与徽章、下面给这 7 天的格子，拆成两张只是多占一屏（约 360px）。
 * 卡内顺序按"先看结论再看明细"：连续天数 → 今天还差什么 → 本周格子 → 徽章墙。
 *
 * 数据由健康页算好传进来：周格子要跟着打卡编辑立刻点亮，
 * 在这里自己读 localStorage 会读到旧值（页面重渲染不会触发它自己的 effect）。
 */
export function StreakCard({
  profileReady,
  targets,
  rewards,
  todayCheckin,
  weekStart,
  onShiftWeek,
  weekCheckins,
  selectedDate,
  earliestDate,
  onSelectDate,
  onReplay,
}: {
  /** 是否已有健康档案：没有时不判定、只给一句引导（不显示 0 天打击人） */
  profileReady: boolean;
  targets: DailyHealthTargets | null;
  rewards: RewardState;
  /** 今天的打卡（连续卡片始终看今天，与正在补录哪一天无关） */
  todayCheckin: DailyCheckin | null;
  weekStart: string;
  /** 翻周：-1 上一周 / +1 下一周 */
  onShiftWeek: (deltaWeeks: number) => void;
  weekCheckins: DailyCheckin[];
  selectedDate: string;
  earliestDate: string;
  onSelectDate: (date: string) => void;
  /** 点「回看庆祝」时，把当前连续值与已得徽章交给父组件弹窗 */
  onReplay: (streak: number, badges: Badge[]) => void;
}) {
  const today = todayISO();
  const currentStreak = calcCurrentStreak(rewards.days, today);
  const maxStreak = calcMaxStreak(rewards.days);
  const todayCompletion = evaluateCheckin(todayCheckin, targets);
  const nextB = nextBadge(rewards.badges);

  return (
    <div className="heal-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">🔥 坚持</span>
        {/* 有任何达成记录时，允许随时回看庆祝（重放动画与彩带） */}
        {maxStreak > 0 && (
          <button
            type="button"
            onClick={() => onReplay(currentStreak, BADGES.filter((b) => rewards.badges[b.id]))}
            className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs"
          >
            🎬 回看庆祝
          </button>
        )}
      </div>

      {!profileReady || !targets ? (
        <p className="text-xs leading-6" style={{ color: "var(--heal-muted)" }}>
          先在下面填好健康档案，喝水和步数才有目标线；每天两样都达标，就能点亮连续天数、解锁徽章。
        </p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3 text-center" style={{ background: "var(--heal-amber-50)" }}>
              <div className="text-2xl font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                🔥 {currentStreak}
              </div>
              <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                当前连续
              </div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "var(--heal-blue-50)" }}>
              <div className="text-2xl font-medium" style={{ color: "var(--heal-blue-text)" }}>
                ⭐ {maxStreak}
              </div>
              <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                历史最长
              </div>
            </div>
          </div>

          <p className="mb-3 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            {todayCompletion.allDone
              ? "今天已完成 ✅ 明天继续，别断签哦"
              : `今天还差：${!todayCompletion.waterDone ? "喝水 " : ""}${!todayCompletion.stepsDone ? "步数" : ""}（两项都达标才算 1 天）`}
          </p>

          {/* 本周格子（原来单独一张卡，合并到这里） */}
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
              本周打卡
            </span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="上一周" onClick={() => onShiftWeek(-1)} className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs">
                ‹
              </button>
              <button type="button" aria-label="下一周" onClick={() => onShiftWeek(1)} className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs">
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDates(weekStart).map((d, i) => {
              const c = weekCheckins.find((x) => x.date === d);
              const okWater = !!(targets && c && c.waterMl >= targets.waterTarget);
              const okSteps = !!(targets && c && c.steps >= targets.stepsTarget);
              const allDone = okWater && okSteps;
              // 可点进该日补录：不早于最早可补日期、且不是未来
              const pickable = d <= today && d >= earliestDate;
              const isSelected = d === selectedDate;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!pickable}
                  onClick={() => onSelectDate(d)}
                  title={pickable ? (d === today ? "今天" : `补录 ${d}`) : undefined}
                  className="rounded-xl px-1 py-2 transition-transform active:scale-95"
                  style={{
                    background: "var(--heal-blue-50)",
                    outline: isSelected ? "1.5px solid var(--heal-amber-accent)" : "none",
                    opacity: pickable ? 1 : 0.55,
                    cursor: pickable ? "pointer" : "default",
                  }}
                >
                  <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                    {WEEKDAY_LABELS[i]}
                  </div>
                  <div className="mt-1 text-sm leading-none">
                    {allDone ? (
                      <span title="两项都达标">✅</span>
                    ) : (
                      <>
                        {okWater ? "💧" : ""}
                        {okSteps ? "🚶" : ""}
                        {!okWater && !okSteps ? <span className="text-[10px]" style={{ color: "var(--heal-card-border)" }}>·</span> : ""}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            💧 喝够水 · 🚶 走够步 · ✅ 两样都达标（计入连续天数）；点日期可补录漏记的那天
          </p>

          {/* 徽章墙 */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {BADGES.map((b) => {
              const owned = !!rewards.badges[b.id];
              return (
                <div
                  key={b.id}
                  className="rounded-xl p-2 text-center"
                  style={{
                    background: owned ? "var(--heal-amber-50)" : "var(--heal-blue-50)",
                    opacity: owned ? 1 : 0.55,
                  }}
                >
                  <div className="text-xl">{b.emoji}</div>
                  <div className="text-[10px] font-medium" style={{ color: owned ? "var(--heal-amber-deep)" : "var(--heal-muted)" }}>
                    {b.label}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                    {owned ? "已达成" : nextB && nextB.id === b.id ? `还差 ${Math.max(0, b.days - maxStreak)} 天` : `${b.days} 天`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
