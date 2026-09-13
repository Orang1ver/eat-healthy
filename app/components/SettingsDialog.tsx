"use client";

import { useEffect, useState } from "react";
import { loadApiKeys, saveApiKeys, type ApiKeys } from "../lib/apiKeys";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keys, setKeys] = useState<ApiKeys>({});

  useEffect(() => {
    if (open) setKeys(loadApiKeys());
  }, [open]);

  if (!open) return null;

  function save() {
    saveApiKeys(keys);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="heal-card w-full max-w-md p-5" style={{ background: "var(--heal-card-bg)" }}>
        <h2 className="mb-1 text-lg font-medium" style={{ color: "var(--foreground)" }}>
          ⚙️ API 设置
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--heal-muted)" }}>
          Key 只存在你这台设备的浏览器里，直接由浏览器请求 DeepSeek，不经过任何中间服务器。
        </p>

        <label className="mb-1 block text-sm font-medium">DeepSeek API Key</label>
        <input
          type="password"
          className="mb-2 w-full rounded-xl border p-2 text-sm"
          placeholder="sk-..."
          value={keys.deepseekKey || ""}
          onChange={(e) => setKeys((k) => ({ ...k, deepseekKey: e.target.value }))}
          style={{ borderColor: "var(--heal-card-border)" }}
        />
        <p className="mb-4 text-[11px] leading-5" style={{ color: "var(--heal-muted)" }}>
          在 platform.deepseek.com 注册后创建。推荐与截图识别用同一个 Key。
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
            取消
          </button>
          <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
