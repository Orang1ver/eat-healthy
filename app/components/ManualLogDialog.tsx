"use client";

import { useEffect, useState } from "react";
import { chatText } from "../lib/deepseek";
import { addMealRecord } from "../lib/storage";
import { nowHM, todayISO } from "../lib/date";
import type { DishIngredient } from "../lib/types";

/**
 * 快捷记一餐：不走完整推荐流程，选好食材后直接把"今天吃的"记下来。
 * 名字可以手填，也可以让 AI 按食材+口味偏好起一个家常菜名。
 */
export function ManualLogDialog({
  open,
  onClose,
  ingredients,
  flavorTags,
  note,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  ingredients: string[];
  flavorTags: string[];
  note: string;
  goal: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHM());
  const [naming, setNaming] = useState(false);
  const [err, setErr] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDate(todayISO());
      setTime(nowHM());
      setErr("");
      setHint("");
    }
  }, [open]);

  if (!open) return null;

  /** 让 AI 按食材起一个家常菜名；没填 Key 时降级为提示手填 */
  async function aiName() {
    setErr("");
    setHint("");
    if (ingredients.length === 0) {
      setErr("先选几个食材，AI 才好起名");
      return;
    }
    setNaming(true);
    try {
      const parts = [
        `食材：${ingredients.join("、")}`,
        flavorTags.length ? `口味偏好：${flavorTags.join("、")}` : "",
        note.trim() ? `备注：${note.trim()}` : "",
        goal.trim() ? `饮食目标：${goal.trim()}` : "",
      ].filter(Boolean);
      const name = await chatText(
        `根据下面的信息，起一个具体、接地气的中文家常菜名（可含主食，如"番茄鸡蛋盖饭"）。只返回菜名本身，不要解释、不要引号、不超过 12 个字。\n\n${parts.join("\n")}`,
        0.4,
      );
      const clean = name.trim().replace(/^["「『]|["」』]$/g, "").slice(0, 20);
      if (clean) {
        setTitle(clean);
        setHint(`AI 起的名字：${clean}（可以直接改）`);
      } else {
        setErr("AI 没起出来，自己填一个吧");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setNaming(false);
    }
  }

  function save() {
    const name = title.trim();
    if (!name) {
      setErr("先填个名字（或点 AI 取名）");
      return;
    }
    const ings: DishIngredient[] = ingredients.map((label) => ({ label, fromPantry: true }));
    addMealRecord({
      date,
      time,
      title: name,
      dishes: [{ name, role: "主菜", ingredients: ings, flavorTags }],
      channel: "自己做",
      avoidTags: [],
      methodTags: [],
      goal: goal.trim() || undefined,
      source: "manual",
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center heal-scrim p-4">
      <div className="heal-card w-full max-w-sm p-5" style={{ background: "var(--heal-card-bg)" }}>
        <h2 className="mb-1 text-base font-medium">📝 记下这顿</h2>
        <p className="mb-3 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
          {ingredients.length > 0 ? `用了：${ingredients.join("、")}` : "没有选食材，直接记个名字也行"}
        </p>

        <label className="mb-1 block text-xs font-medium">这顿叫什么</label>
        <div className="mb-1 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border p-2 text-sm"
            placeholder="如：番茄鸡蛋盖饭"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <button
            type="button"
            disabled={naming}
            onClick={aiName}
            className="heal-btn heal-btn-feature whitespace-nowrap px-3 py-2 text-xs"
            title="让 AI 根据食材起名"
          >
            {naming ? "起名中…" : "✨ AI 取名"}
          </button>
        </div>
        {hint && (
          <p className="mb-2 text-[12px]" style={{ color: "var(--heal-blue-text)" }}>
            {hint}
          </p>
        )}

        <div className="my-3 flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border p-2 text-sm"
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-xl border p-2 text-sm"
            style={{ borderColor: "var(--heal-card-border)" }}
          />
        </div>

        {err && <p className="mb-2 text-xs leading-5 text-rose-600">{err}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
            取消
          </button>
          <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
            记下来
          </button>
        </div>
      </div>
    </div>
  );
}
