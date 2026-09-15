"use client";

import { useEffect, useState } from "react";
import { addExercise, loadExerciseAwards, loadExercises, removeExercise, saveExerciseAwards } from "../lib/storage";
import {
  EXERCISE_MILESTONES,
  EXERCISE_TYPES,
  exerciseStats,
  nextMilestone,
  pendingMilestones,
  round1,
  sortExercises,
  weekStats,
  type ExerciseMilestone,
} from "../lib/exercise";
import type { ExerciseAwards, ExerciseRecord, ExerciseType } from "../lib/types";
import { todayISO, weekStartOf } from "../lib/date";

/**
 * 运动记录：记一笔（类型 + 时长 / 距离 / 备注）、本周概览、里程碑、历史列表。
 *
 * 与步数打卡**互相独立**：这里不写 rewards.days，也不碰打卡徽章，
 * 避免同一段运动被重复计算、或让运动成就混进「坚持 N 天」的徽章墙。
 * 达成新的运动里程碑时通过 onMilestone 通知父组件弹庆祝；普通记录只给一行轻提示。
 */
export function ExerciseCard({
  onMilestone,
}: {
  /** 达成新里程碑时通知父组件弹庆祝（父组件负责显示 RewardDialog） */
  onMilestone: (
    milestones: ExerciseMilestone[],
    hero: { emoji: string; value: number | string; unit: string; caption: string },
  ) => void;
}) {
  const today = todayISO();
  const [list, setList] = useState<ExerciseRecord[]>([]);
  const [type, setType] = useState<ExerciseType>("散步");
  // 数字输入用字符串 state：直接存 number 会导致删不掉、永远留个 0
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [awards, setAwards] = useState<ExerciseAwards>({});

  useEffect(() => {
    setList(loadExercises());
    setAwards(loadExerciseAwards());
  }, []);

  const stats = exerciseStats(list);
  const week = weekStats(list, weekStartOf(today));
  const ordered = sortExercises(list);
  const next = nextMilestone(stats, awards);
  const activeType = EXERCISE_TYPES.find((t) => t.key === type) ?? EXERCISE_TYPES[0];

  function record() {
    setMsg("");
    setErr("");
    const mins = minutes.trim() === "" ? undefined : Number(minutes);
    const km = distance.trim() === "" ? undefined : Number(distance);
    if (mins === undefined && km === undefined) {
      setErr("时长和距离至少填一个");
      return;
    }
    if (mins !== undefined && (!Number.isFinite(mins) || mins <= 0 || mins > 1440)) {
      setErr("时长请填 1~1440 分钟");
      return;
    }
    if (km !== undefined && (!Number.isFinite(km) || km <= 0 || km > 500)) {
      setErr("距离请填 0~500 公里");
      return;
    }

    const nextList = addExercise({
      date: today,
      type,
      minutes: mins,
      distanceKm: km,
      note: note.trim() || undefined,
    });
    setList(nextList);

    // 里程碑结算：阈值达成且尚未拥有才发（幂等靠 awards 里有没有这个 id）
    const s = exerciseStats(nextList);
    const fresh = pendingMilestones(s, awards);
    if (fresh.length > 0) {
      const nextAwards = { ...awards };
      for (const m of fresh) nextAwards[m.id] = today;
      saveExerciseAwards(nextAwards);
      setAwards(nextAwards);
      // 主视觉用"总量"更有分量：优先里程，其次次数
      const kmTotal = round1(s.km);
      const useKm = kmTotal >= 1;
      onMilestone(fresh, {
        emoji: fresh[0].emoji,
        value: useKm ? kmTotal : s.count,
        unit: useKm ? "km 累计" : "次累计",
        caption: "运动记录",
      });
    } else {
      const parts: string[] = [type];
      if (mins !== undefined) parts.push(`${mins} 分钟`);
      if (km !== undefined) parts.push(`${km}km`);
      setMsg(`已记下${parts.join(" · ")}`);
    }

    setMinutes("");
    setDistance("");
    setNote("");
  }

  function handleRemove(id: string, label: string) {
    if (!confirm(`删掉这条运动记录（${label}）？`)) return;
    setList(removeExercise(id));
    setMsg("");
    setErr("");
  }

  return (
    <div className="heal-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">🏃 运动记录</span>
        <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
          本周 {week.count} 次 · {week.km} km
        </span>
      </div>

      {/* 本周概览 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: "var(--heal-blue-text)" }}>
            {week.count}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            本周次数
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: "var(--heal-blue-text)" }}>
            {week.minutes}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            本周分钟
          </div>
        </div>
        <div className="rounded-2xl p-2 text-center" style={{ background: "var(--heal-blue-50)" }}>
          <div className="text-lg font-medium" style={{ color: "var(--heal-blue-text)" }}>
            {week.km}
          </div>
          <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
            本周公里
          </div>
        </div>
      </div>

      {/* 运动类型 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {EXERCISE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setType(t.key);
              setMsg("");
              setErr("");
            }}
            className={`heal-btn px-2.5 py-1.5 text-xs ${type === t.key ? "heal-btn-feature" : "heal-btn-ghost"}`}
          >
            {t.emoji} {t.key}
          </button>
        ))}
      </div>

      {/* 时长 / 距离 / 备注 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
            setMsg("");
            setErr("");
          }}
          className="w-20 rounded-full border px-2 py-1.5 text-center text-sm"
          style={{ borderColor: "var(--heal-card-border)" }}
        />
          <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
          分钟
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={500}
          value={distance}
          onChange={(e) => {
            setDistance(e.target.value);
            setMsg("");
            setErr("");
          }}
          className="w-20 rounded-full border px-2 py-1.5 text-center text-sm"
          style={{ borderColor: "var(--heal-card-border)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
          公里
        </span>
      </div>
      <p className="mb-2 text-[10px]" style={{ color: "var(--heal-muted)" }}>
        {activeType.emoji} {activeType.key}：{activeType.hint}（时长与距离至少填一个）
      </p>

      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选，如：公园快走、和朋友爬山）"
          className="min-w-0 flex-1 rounded-full border px-3 py-1.5 text-xs"
          style={{ borderColor: "var(--heal-card-border)" }}
        />
        <button type="button" onClick={record} className="heal-btn heal-btn-primary px-3 py-1.5 text-xs">
          记一笔
        </button>
      </div>

      {msg && (
        <p className="mb-2 text-[11px] leading-5" style={{ color: "var(--heal-blue-text)" }}>
          {msg}
        </p>
      )}
      {err && <p className="mb-2 text-[11px] leading-5 text-rose-600">{err}</p>}

      {/* 里程碑 */}
      <div className="mt-3">
        <div className="mb-1 text-[11px]" style={{ color: "var(--heal-muted)" }}>
          运动里程碑
        </div>
        <div className="grid grid-cols-3 gap-2">
          {EXERCISE_MILESTONES.map((m) => {
            const owned = !!awards[m.id];
            return (
              <div
                key={m.id}
                className="rounded-xl p-2 text-center"
                style={{
                  background: owned ? "var(--heal-amber-50)" : "var(--heal-blue-50)",
                  opacity: owned ? 1 : 0.55,
                }}
              >
                <div className="text-xl">{m.emoji}</div>
                <div
                  className="text-[10px] font-medium"
                  style={{ color: owned ? "var(--heal-amber-deep)" : "var(--heal-muted)" }}
                >
                  {m.label}
                </div>
                <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                  {owned ? "已达成" : next && next.id === m.id ? m.progress(stats) : "未达成"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 最近记录 */}
      {ordered.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
              累计 {stats.count} 次 · {stats.km} km · {stats.activeDays} 天
            </span>
            {ordered.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="heal-btn heal-btn-ghost px-2 py-0.5 text-[11px]">
                {showAll ? "收起" : "展开全部"}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {(showAll ? ordered : ordered.slice(0, 5)).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs"
                style={{ background: "var(--heal-blue-50)" }}
              >
                <span className="shrink-0 text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  {e.date.slice(5)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{e.type}</span>
                  {e.minutes !== undefined && ` · ${e.minutes} 分钟`}
                  {e.distanceKm !== undefined && ` · ${e.distanceKm}km`}
                  {e.note && <span style={{ color: "var(--heal-muted)" }}>{` · ${e.note}`}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(e.id, `${e.date.slice(5)} ${e.type}`)}
                  aria-label={`删除 ${e.date} 的${e.type}记录`}
                  className="shrink-0 opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
