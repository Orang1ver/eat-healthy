"use client";

import { useEffect, useState } from "react";
import { nowHM, todayISO } from "../lib/date";

export function SaveMealDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHM());

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setTime(nowHM());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center heal-scrim p-4">
      <div className="heal-card w-full max-w-sm p-5">
        <h2 className="mb-1 text-base font-medium">记到什么时候？</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--heal-muted)" }}>
          自由选择具体时间，不用套用固定的早/午/晚餐时段。
        </p>
        <div className="mb-4 flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-xl border p-2 text-sm"
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
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
            取消
          </button>
          <button type="button" onClick={() => onConfirm(date, time)} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
