"use client";

import { useState } from "react";
import { DISH_ROLES, type DishRole } from "../lib/tags";
import { deleteMealRecord, updateMealRecord } from "../lib/storage";
import type { Dish, MealRecord, TakeoutDish } from "../lib/types";
import { TakeoutPicker, dishFromTakeout } from "./TakeoutPicker";

export function MealDetailDialog({
  meal,
  onClose,
  onChanged,
}: {
  meal: MealRecord | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [timeValue, setTimeValue] = useState("");
  /** 编辑态里的「从菜单库加菜」默认收起：编辑表单本来就挤，需要时才展开 */
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!meal) return null;

  function startEdit() {
    setDishes(meal!.dishes.map((d) => ({ ...d, ingredients: [...d.ingredients] })));
    setTimeValue(meal!.time);
    setPickerOpen(false);
    setEditing(true);
  }

  function save() {
    updateMealRecord(meal!.id, { dishes, time: timeValue });
    setEditing(false);
    onChanged();
    onClose();
  }

  function removeRecord() {
    deleteMealRecord(meal!.id);
    onChanged();
    onClose();
  }

  function updateDish(i: number, patch: Partial<Dish>) {
    setDishes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function removeDish(i: number) {
    setDishes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDish() {
    setDishes((prev) => [...prev, { name: "", role: "小菜", ingredients: [], flavorTags: [] }]);
  }

  /** 从菜单库加/删一道菜（按菜名判定，见 TakeoutPicker 的说明） */
  function toggleFromLibrary(d: TakeoutDish) {
    setDishes((prev) => {
      const at = prev.findIndex((x) => x.name === d.name);
      if (at >= 0) return prev.filter((_, i) => i !== at);
      return [...prev, dishFromTakeout(d)];
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center heal-scrim p-4">
      <div className="heal-card max-h-[85vh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-base font-medium">{meal.title || meal.dishes[0]?.name || "这一餐"}</h2>
          <span className="text-xs" style={{ color: "var(--heal-muted)" }}>
            {meal.date} · {meal.time} · {meal.channel}
          </span>
        </div>

        {!editing ? (
          <>
            <div className="my-3 flex flex-col gap-2">
              {meal.dishes.map((dish, i) => (
                <div key={i} className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--heal-bg)", border: "0.5px solid var(--heal-card-border)" }}>
                  <span className="font-medium">{dish.name}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--heal-muted)" }}>
                    [{dish.role}] {dish.ingredients.map((d) => d.label).join("、")}
                  </span>
                </div>
              ))}
            </div>
            {meal.aiMessage && (
              <div className="mb-3 rounded-2xl p-3 text-sm leading-7" style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }}>
                ❤ {meal.aiMessage}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={removeRecord} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
                删除 🗑️
              </button>
              <button type="button" onClick={startEdit} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
                编辑 ✏️
              </button>
              <button type="button" onClick={onClose} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
                关闭
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="my-3">
              <label className="mb-1 block text-xs" style={{ color: "var(--heal-muted)" }}>
                就餐时间
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="rounded-lg border px-2 py-1 text-sm"
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div className="mb-3 flex flex-col gap-2">
              {dishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border px-2 py-1 text-sm"
                    value={dish.name}
                    onChange={(e) => updateDish(i, { name: e.target.value })}
                    style={{ borderColor: "var(--heal-card-border)" }}
                  />
                  <select
                    value={dish.role}
                    onChange={(e) => updateDish(i, { role: e.target.value as DishRole })}
                    className="rounded-lg border px-1 py-1 text-xs"
                    style={{ borderColor: "var(--heal-card-border)" }}
                  >
                    {DISH_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-28 rounded-lg border px-2 py-1 text-xs"
                    placeholder="食材，逗号分隔"
                    value={dish.ingredients.map((x) => x.label).join(",")}
                    onChange={(e) =>
                      updateDish(i, {
                        ingredients: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((label) => ({ label, fromPantry: true })),
                      })
                    }
                    style={{ borderColor: "var(--heal-card-border)" }}
                  />
                  <button type="button" onClick={() => removeDish(i)} className="text-xs" style={{ color: "var(--heal-muted)" }}>
                    ×
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addDish} className="heal-btn heal-btn-ghost px-2 py-1 text-xs">
                  + 新增一道菜
                </button>
                {/* 编辑旧记录时也常是"忘了记外卖"，所以这里也给一个从库里挑的入口（默认收起） */}
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                  className="heal-btn heal-btn-ghost px-2 py-1 text-xs"
                >
                  🍱 从菜单库加菜
                </button>
              </div>
            </div>

            {pickerOpen && <TakeoutPicker pickedNames={dishes.map((d) => d.name)} onToggle={toggleFromLibrary} showEmptyHint />}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPickerOpen(false);
                }}
                className="heal-btn heal-btn-ghost px-3 py-2 text-sm"
              >
                取消
              </button>
              <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
                保存修改
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
