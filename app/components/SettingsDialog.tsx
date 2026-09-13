"use client";

import { useEffect, useState } from "react";
import { loadApiKeys, saveApiKeys, type ApiKeys } from "../lib/apiKeys";
import { backupToText, clearAllData, describeBackup, downloadBackup, importBackup } from "../lib/backup";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [tab, setTab] = useState<"key" | "backup">("key");

  // 备份
  const [includeKey, setIncludeKey] = useState(true);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setKeys(loadApiKeys());
      setTab("key");
      setExportText("");
      setImportText("");
      setMsg("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  function save() {
    saveApiKeys(keys);
    onClose();
  }

  async function copyBackup() {
    setMsg("");
    setErr("");
    const text = backupToText(includeKey);
    setExportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setMsg("已复制。发给家人，让他们粘到下方导入即可完成设置");
    } catch {
      // iOS 非 https 或权限受限时降级为手动复制
      setMsg("已生成备份内容，请在下方长按全选复制");
    }
  }

  function doImport(overwrite: boolean) {
    setMsg("");
    setErr("");
    try {
      const summary = describeBackup(importText);
      if (overwrite && !confirm("覆盖导入会清空你现有的全部数据，确定吗？")) return;
      const { keys: n } = importBackup(importText, overwrite);
      setMsg(
        `导入完成，写入 ${n} 项（${summary}）。` +
          (n === 0 ? "已有数据被保留，未做覆盖。" : ""),
      );
      if (n > 0) setTimeout(() => location.reload(), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function doClear() {
    if (!confirm("会清空健康档案、打卡、饮食记录、菜单库和 API Key，且无法恢复。建议先导出备份。确定继续吗？")) return;
    clearAllData();
    setMsg("已清空，正在重新加载…");
    setTimeout(() => location.reload(), 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="heal-card flex max-h-[85vh] w-full max-w-md flex-col p-5" style={{ background: "var(--heal-card-bg)" }}>
        <h2 className="mb-3 text-lg font-medium" style={{ color: "var(--foreground)" }}>
          ⚙️ 设置
        </h2>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("key")}
            className={`heal-btn flex-1 px-3 py-1.5 text-xs ${tab === "key" ? "heal-btn-feature" : "heal-btn-ghost"}`}
          >
            API Key
          </button>
          <button
            type="button"
            onClick={() => setTab("backup")}
            className={`heal-btn flex-1 px-3 py-1.5 text-xs ${tab === "backup" ? "heal-btn-feature" : "heal-btn-ghost"}`}
          >
            数据备份
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "key" && (
            <>
              <p className="mb-4 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
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
              <p className="text-[11px] leading-5" style={{ color: "var(--heal-muted)" }}>
                在 platform.deepseek.com 注册后创建。推荐与截图识别用同一个 Key。
              </p>
            </>
          )}

          {tab === "backup" && (
            <>
              <p className="mb-3 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
                数据只存在这台设备上。换手机、清理浏览器数据，或想把菜单库和设置分享给家人时，用这里导入导出。
              </p>

              <label className="mb-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} />
                备份里包含 DeepSeek API Key（分享给家人时方便，但注意别外传）
              </label>

              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => downloadBackup(includeKey)} className="heal-btn heal-btn-primary px-3 py-2 text-xs">
                  ⬇️ 导出为文件
                </button>
                <button type="button" onClick={copyBackup} className="heal-btn heal-btn-ghost px-3 py-2 text-xs">
                  📋 复制备份内容
                </button>
              </div>

              {exportText && (
                <textarea
                  readOnly
                  rows={3}
                  value={exportText}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mb-3 w-full rounded-xl border p-2 text-[10px] leading-4"
                  style={{ borderColor: "var(--heal-card-border)" }}
                />
              )}

              <label className="mb-1 block text-xs font-medium">从备份导入</label>
              <textarea
                rows={3}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="粘贴备份 JSON 内容"
                className="mb-2 w-full rounded-xl border p-2 text-[10px] leading-4"
                style={{ borderColor: "var(--heal-card-border)" }}
              />
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" disabled={!importText.trim()} onClick={() => doImport(false)} className="heal-btn heal-btn-feature px-3 py-2 text-xs">
                  合并导入（保留现有数据）
                </button>
                <button type="button" disabled={!importText.trim()} onClick={() => doImport(true)} className="heal-btn heal-btn-ghost px-3 py-2 text-xs">
                  覆盖导入
                </button>
              </div>

              <button type="button" onClick={doClear} className="heal-btn heal-btn-ghost px-3 py-2 text-xs" style={{ color: "#b91c1c" }}>
                🗑️ 清空本机所有数据
              </button>

              {msg && <p className="mt-2 text-xs leading-5" style={{ color: "var(--heal-blue-text)" }}>{msg}</p>}
              {err && <p className="mt-2 text-xs leading-5 text-rose-600">{err}</p>}
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
            取消
          </button>
          {tab === "key" && (
            <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
              保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
