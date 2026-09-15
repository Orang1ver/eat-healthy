"use client";

import { useEffect, useState } from "react";
import { WeightChart } from "./WeightChart";
import { loadWeights, saveWeight, removeWeight } from "../lib/storage";
import {
  baselineForDate,
  deltaColor,
  deltaText,
  deltaVsDaysAgo,
  deltaVsPrevious,
  entryOn,
  latestBefore,
  latestWeight,
  round1,
  sortWeights,
} from "../lib/weight";
import type { WeightEntry } from "../lib/types";
import { addDays, BACKFILL_DAYS, todayISO } from "../lib/date";

const STEP_SMALL = 0.1;
const STEP_BIG = 0.5;

/**
 * 体重记录：选日期（今天 / 往前补录）、递增递减微调、直接输入、趋势曲线、历史列表。
 *
 * 两个约定：
 * 1) **日期上下文自己管**，不跟随健康页打卡卡的 selectedDate —— 否则"一边补录前天的喝水、
 *    一边想记今天的体重"时会不小心把今天的体重记到那天去。
 * 2) **只有记的是「今天」才通过 onRecorded 同步健康档案**。补录过去的日期只写历史，
 *    不能拿旧体重去改档案，否则热量（BMR/TDEE）与喝水目标（35ml/kg）会被悄悄改成旧值。
 *    注意这里不能写成"比已有记录更新就同步"：用户上次记录是三天前时，补录昨天
 *    确实比已有记录新，但那仍然是一次历史补录，不是今天的体重。
 */
export function WeightCard({
  fallbackWeight,
  onRecorded,
}: {
  /** 还没记过体重时，用档案里的体重作为起始值 */
  fallbackWeight: number | null;
  onRecorded: (weightKg: number) => void;
}) {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const earliestDate = addDays(today, -BACKFILL_DAYS);

  const [weights, setWeights] = useState<Record<string, WeightEntry>>({});
  /** 正在记录/补录的日期，默认今天 */
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<number>(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  const viewingToday = date === today;
  const canGoPrev = date > earliestDate;
  const canGoNext = date < today;

  // 载入记录 + 按所选日期给一份草稿：该日已有 → 用该值；没有 → 用更早的最近一条做起点。
  // 依赖里带上 fallbackWeight：记录今天后父组件会同步档案，草稿要跟着回到已记的值。
  useEffect(() => {
    const all = loadWeights();
    setWeights(all);
    setDraft(baselineForDate(all, date, fallbackWeight));
  }, [date, fallbackWeight]);

  const entries = sortWeights(weights);
  const latest = latestWeight(weights);
  const dPrev = deltaVsPrevious(weights);
  const d7 = deltaVsDaysAgo(weights, today, 7);
  const todayEntry = entryOn(weights, today);
  const dayEntry = entryOn(weights, date);

  /**
   * 切日期：顺手清掉上一条提示（旧提示挂在新日期下会看不懂）。
   * 放在事件里而不是 effect 里 —— effect 里同步 setState 是本项目已知的 lint 告警，
   * 没必要为这点事再添一条。
   */
  function goToDate(next: string) {
    if (next === date) return;
    setDate(next);
    setMsg("");
    setErr("");
  }

  function nudge(delta: number) {
    setDraft((v) => round1(Math.min(200, Math.max(25, v + delta))));
    setMsg("");
    setErr("");
  }

  function record() {
    setMsg("");
    setErr("");
    const saved = saveWeight(date, draft);
    if (!saved) {
      setErr("体重需要在 25-200kg 之间");
      return;
    }
    setWeights(saved);

    // 与"该日期之前最近的一条"比：补录夹在中间的那天时，这才是有意义的对比
    const earlier = latestBefore(weights, date);
    const diff = earlier ? round1(draft - earlier.weightKg) : null;
    const diffText = diff !== null ? `（较上次 ${diff > 0 ? "+" : ""}${diff.toFixed(1)}kg）` : "";

    // 只有记的是今天才同步档案：补录过去的日期（哪怕它比已有记录都新）都只写历史
    const becomesLatest = viewingToday;
    if (becomesLatest) onRecorded(draft);

    const head = viewingToday ? "已记录今天" : `已补录 ${date.slice(5)}`;
    setMsg(
      `${head} ${draft.toFixed(1)}kg${diffText}` +
        (becomesLatest ? "，档案体重已同步、目标已重算" : "，只改这一天的记录，档案体重不变"),
    );
  }

  function handleRemove(target: string) {
    if (!confirm(`删掉 ${target} 的体重记录？`)) return;
    setWeights(removeWeight(target));
    setMsg("");
  }

  return (
    <div className="heal-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">⚖️ 体重记录</span>
        {latest && (
          <span className="text-[12px]" style={{ color: "var(--heal-muted)" }}>
            最近 {latest.date.slice(5)}
          </span>
        )}
      </div>

      {/* 记录日期：默认今天，往前最多 BACKFILL_DAYS 天 —— 漏记的那天点一下 ‹ 就能补 */}
      <div
        className="mb-3 flex items-center justify-between gap-2 rounded-xl p-2"
        style={{ background: viewingToday ? "var(--heal-blue-50)" : "var(--heal-amber-50)" }}
      >
        <span className="text-[12px] leading-5" style={{ color: viewingToday ? "var(--heal-muted)" : "var(--heal-amber-text)" }}>
          {viewingToday ? "记录日期：今天" : `正在补录 ${date} 的体重`}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="前一天"
            disabled={!canGoPrev}
            onClick={() => goToDate(addDays(date, -1))}
            className="heal-btn heal-btn-ghost px-2 py-1.5 text-xs"
          >
            ‹
          </button>
          <span className="min-w-[4rem] text-center text-xs" style={{ color: viewingToday ? "var(--heal-muted)" : "var(--heal-amber-deep)" }}>
            {viewingToday ? "今天" : date.slice(5)}
          </span>
          <button
            type="button"
            aria-label="后一天"
            disabled={!canGoNext}
            onClick={() => goToDate(addDays(date, 1))}
            className="heal-btn heal-btn-ghost px-2 py-1.5 text-xs"
          >
            ›
          </button>
          {!viewingToday && (
            <button type="button" onClick={() => goToDate(today)} className="heal-btn heal-btn-ghost px-2 py-1 text-[12px]">
              回到今天
            </button>
          )}
        </div>
      </div>

      {/* 昨天漏记时给一句能照做的提示（从今天点一下 ‹ 就到昨天） */}
      {viewingToday && !todayEntry && !weights[yesterday] && (
        <p className="mb-3 text-[12px] leading-5" style={{ color: "var(--heal-amber-deep)" }}>
          昨天（{yesterday.slice(5)}）还没记，点上面的 ‹ 就能补录
        </p>
      )}

      {/* 概览：草稿 + 变化 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-amber-50)" }}>
          <div className="text-lg font-medium" style={{ color: "var(--heal-amber-deep)" }}>
            {draft.toFixed(1)}
          </div>
          <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
            {viewingToday ? "待记录 kg" : dayEntry ? "该日已记 kg" : "待补录 kg"}
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: dPrev ? deltaColor(dPrev.diff) : "var(--heal-muted)" }}>
            {dPrev ? deltaText(dPrev.diff) : "—"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
            较上次
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: d7 ? deltaColor(d7.diff) : "var(--heal-muted)" }}>
            {d7 ? deltaText(d7.diff) : "—"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
            近 7 天
          </div>
        </div>
      </div>

      {!viewingToday && (
        <p className="mb-3 text-[11px] leading-4" style={{ color: "var(--heal-muted)" }}>
          「较上次 / 近 7 天」按最新一条记录算；这里改的是 {date.slice(5)} 那天
        </p>
      )}

      {/* 递增递减 + 直接输入 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => nudge(-STEP_BIG)} className="heal-btn heal-btn-ghost px-2.5 py-1.5 text-xs">
          −{STEP_BIG}
        </button>
        <button type="button" onClick={() => nudge(-STEP_SMALL)} className="heal-btn heal-btn-ghost px-2.5 py-1.5 text-xs">
          −{STEP_SMALL}
        </button>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={25}
          max={200}
          value={draft || ""}
          onChange={(e) => {
            setDraft(Number(e.target.value) || 0);
            setMsg("");
            setErr("");
          }}
          className="w-20 rounded-full border px-2 py-1.5 text-center text-sm"
          style={{ borderColor: "var(--heal-card-border)" }}
        />
        <button type="button" onClick={() => nudge(STEP_SMALL)} className="heal-btn heal-btn-ghost px-2.5 py-1.5 text-xs">
          +{STEP_SMALL}
        </button>
        <button type="button" onClick={() => nudge(STEP_BIG)} className="heal-btn heal-btn-ghost px-2.5 py-1.5 text-xs">
          +{STEP_BIG}
        </button>
        <button type="button" onClick={record} className="heal-btn heal-btn-primary ml-auto px-3 py-1.5 text-xs">
          {viewingToday ? (todayEntry ? "更新今天" : "记录今天") : dayEntry ? `更新 ${date.slice(5)}` : `补录 ${date.slice(5)}`}
        </button>
      </div>

      {msg && <p className="mb-2 text-[12px] leading-5" style={{ color: "var(--heal-blue-text)" }}>{msg}</p>}
      {err && <p className="mb-2 text-[12px] leading-5 text-rose-600">{err}</p>}

      {/* 趋势曲线 */}
      <div className="mt-3">
        <WeightChart entries={entries} />
      </div>

      {/* 历史记录 */}
      {entries.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--heal-muted)" }}>
              共 {entries.length} 条记录
            </span>
            {entries.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="heal-btn heal-btn-ghost px-2 py-1.5 text-[12px]">
                {showAll ? "收起" : `展开全部`}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {(showAll ? [...entries].reverse() : [...entries].reverse().slice(0, 5)).map((e, i, arr) => {
              // 与"上一条更早的记录"对比（列表是倒序，所以 arr[i+1] 更早）
              const earlier = arr[i + 1];
              const diff = earlier ? round1(e.weightKg - earlier.weightKg) : null;
              const active = e.date === date;
              return (
                <li
                  key={e.date}
                  className="flex items-center gap-1 rounded-xl"
                  style={{
                    background: "var(--heal-blue-50)",
                    outline: active ? "1.5px solid var(--heal-amber-accent)" : "none",
                  }}
                >
                  {/* 两个并列按钮（按钮不能嵌套）：左侧整行点一下 = 切到那天改，右侧 × 删除 */}
                  <button
                    type="button"
                    onClick={() => goToDate(e.date)}
                    title={e.date === today ? "今天" : `改 ${e.date} 的记录`}
                    className="flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-xs"
                  >
                    <span style={{ color: "var(--heal-muted)" }}>{e.date.slice(5)}</span>
                    <span className="font-medium">{e.weightKg.toFixed(1)} kg</span>
                    <span style={{ color: diff !== null ? deltaColor(diff) : "var(--heal-muted)" }}>
                      {diff !== null ? deltaText(diff) : "首次"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(e.date)}
                    aria-label={`删除${e.date}`}
                    className="shrink-0 px-2 py-1.5 text-xs opacity-50"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
