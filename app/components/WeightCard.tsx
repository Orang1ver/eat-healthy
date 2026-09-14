"use client";

import { useEffect, useState } from "react";
import { WeightChart } from "./WeightChart";
import { loadWeights, saveWeight, removeWeight } from "../lib/storage";
import { deltaColor, deltaText, deltaVsDaysAgo, deltaVsPrevious, latestWeight, round1, sortWeights } from "../lib/weight";
import type { WeightEntry } from "../lib/types";
import { todayISO } from "../lib/date";

const STEP_SMALL = 0.1;
const STEP_BIG = 0.5;

/**
 * 体重记录：递增递减微调、直接输入、趋势曲线、历史列表。
 * 记录后通过 onRecorded 回调把新体重同步给健康档案（目标随之重算）。
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
  const [weights, setWeights] = useState<Record<string, WeightEntry>>({});
  const [draft, setDraft] = useState<number>(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const all = loadWeights();
    setWeights(all);
    const latest = latestWeight(all);
    const start = latest?.weightKg ?? fallbackWeight ?? 60;
    setDraft(round1(start));
  }, [fallbackWeight]);

  const entries = sortWeights(weights);
  const latest = latestWeight(weights);
  const dPrev = deltaVsPrevious(weights);
  const d7 = deltaVsDaysAgo(weights, today, 7);
  const todayEntry = weights[today];

  function nudge(delta: number) {
    setDraft((v) => {
      const next = round1(Math.min(200, Math.max(25, v + delta)));
      return next;
    });
    setMsg("");
    setErr("");
  }

  function record() {
    setMsg("");
    setErr("");
    const saved = saveWeight(today, draft);
    if (!saved) {
      setErr("体重需要在 25-200kg 之间");
      return;
    }
    setWeights(saved);
    onRecorded(draft);
    const prev = latestWeight(weights);
    const diff = prev && prev.date !== today ? round1(draft - prev.weightKg) : null;
    setMsg(
      `已记录今天 ${draft.toFixed(1)}kg` +
        (diff !== null ? `（较上次 ${diff > 0 ? "+" : ""}${diff.toFixed(1)}kg）` : "") +
        "，档案体重已同步、目标已重算",
    );
  }

  function handleRemove(date: string) {
    if (!confirm(`删掉 ${date} 的体重记录？`)) return;
    setWeights(removeWeight(date));
    setMsg("");
  }

  return (
    <div className="heal-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">⚖️ 体重记录</span>
        {latest && (
          <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
            最近 {latest.date.slice(5)}
          </span>
        )}
      </div>

      {/* 概览：当前体重 + 变化 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-amber-50)" }}>
          <div className="text-lg font-medium" style={{ color: "var(--heal-amber-deep)" }}>
            {draft.toFixed(1)}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            待记录 kg
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: dPrev ? deltaColor(dPrev.diff) : "var(--heal-muted)" }}>
            {dPrev ? deltaText(dPrev.diff) : "—"}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            较上次
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: d7 ? deltaColor(d7.diff) : "var(--heal-muted)" }}>
            {d7 ? deltaText(d7.diff) : "—"}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            近 7 天
          </div>
        </div>
      </div>

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
          {todayEntry ? "更新今天" : "记录今天"}
        </button>
      </div>

      {msg && <p className="mb-2 text-[11px] leading-5" style={{ color: "var(--heal-blue-text)" }}>{msg}</p>}
      {err && <p className="mb-2 text-[11px] leading-5 text-rose-600">{err}</p>}

      {/* 趋势曲线 */}
      <div className="mt-3">
        <WeightChart entries={entries} />
      </div>

      {/* 历史记录 */}
      {entries.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
              共 {entries.length} 条记录
            </span>
            {entries.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="heal-btn heal-btn-ghost px-2 py-0.5 text-[11px]">
                {showAll ? "收起" : `展开全部`}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {(showAll ? [...entries].reverse() : [...entries].reverse().slice(0, 5)).map((e, i, arr) => {
              // 与"上一条更早的记录"对比（列表是倒序，所以 arr[i+1] 更早）
              const earlier = arr[i + 1];
              const diff = earlier ? round1(e.weightKg - earlier.weightKg) : null;
              return (
                <li
                  key={e.date}
                  className="flex items-center justify-between rounded-xl px-2 py-1.5 text-xs"
                  style={{ background: "var(--heal-blue-50)" }}
                >
                  <span style={{ color: "var(--heal-muted)" }}>{e.date.slice(5)}</span>
                  <span className="font-medium">{e.weightKg.toFixed(1)} kg</span>
                  <span style={{ color: diff !== null ? deltaColor(diff) : "var(--heal-muted)" }}>
                    {diff !== null ? deltaText(diff) : "首次"}
                  </span>
                  <button type="button" onClick={() => handleRemove(e.date)} aria-label={`删除${e.date}`} className="opacity-50">
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
