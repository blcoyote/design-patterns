import { useState } from "react";
import type { SaveResult } from "@/lib/layoutSave";

const buttonClass =
  "rounded-control px-3 py-2 text-sm text-fg-soft ring-1 ring-control-outline transition hover:bg-surface-raised hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

/** Snap steps offered by the toolbar; `null` is "off". */
const SNAP_OPTIONS: readonly (number | null)[] = [null, 5, 10, 20];

interface LayoutToolbarProps {
  snap: number | null;
  onSnapChange: (snap: number | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasChanges: boolean;
  onReset: () => void;
  showPackets: boolean;
  onShowPacketsChange: (show: boolean) => void;
  /** The text Copy JSON puts on the clipboard (the diff as JSON). */
  json: string;
  /** Writes the current changes into the definition's index.ts (dev server only). */
  onSave: () => Promise<SaveResult>;
}

type CopyState = "idle" | "copied" | "failed";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; file: string }
  | { kind: "error"; message: string };

/** Editor controls: snap step, undo/redo, reset, packet toggle and Copy JSON. */
export function LayoutToolbar({
  snap,
  onSnapChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasChanges,
  onReset,
  showPackets,
  onShowPacketsChange,
  json,
  onSave,
}: LayoutToolbarProps) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const saveToSource = async () => {
    setSave({ kind: "saving" });
    const result = await onSave();
    setSave(
      result.ok ? { kind: "saved", file: result.file } : { kind: "error", message: result.error },
    );
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopy("copied");
    } catch {
      // no clipboard API (insecure origin) or permission denied: show the text to copy by hand
      setCopy("failed");
    }
  };

  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="Layout editor" className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          Snap
          <select
            aria-label="Snap"
            value={snap === null ? "off" : String(snap)}
            onChange={(e) => onSnapChange(e.target.value === "off" ? null : Number(e.target.value))}
            className="rounded-control bg-surface px-2 py-2 text-sm text-fg ring-1 ring-control-outline"
          >
            {SNAP_OPTIONS.map((option) => (
              <option key={option ?? "off"} value={option === null ? "off" : String(option)}>
                {option === null ? "off" : option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl/Cmd+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl/Cmd+Shift+Z, Ctrl+Y)"
        >
          Redo
        </button>
        <button type="button" className={buttonClass} disabled={!hasChanges} onClick={onReset}>
          Reset all
        </button>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={showPackets}
            onChange={(e) => onShowPacketsChange(e.target.checked)}
          />
          Show packets
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={!hasChanges}
          onClick={() => void copyJson()}
        >
          Copy JSON
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!hasChanges || !import.meta.env.DEV || save.kind === "saving"}
          onClick={() => void saveToSource()}
          title="Write these changes into the pattern's index.ts (dev server only)"
        >
          {save.kind === "saving" ? "Saving…" : "Save to source"}
        </button>
        <span role="status" className="text-sm text-fg-muted">
          {copy === "copied" && "Copied to clipboard."}
          {copy === "failed" && "Clipboard unavailable: copy the JSON below by hand."}
          {save.kind === "saved" && !hasChanges && `Saved to ${save.file}.`}
        </span>
      </div>
      {save.kind === "error" && (
        <p role="alert" className="text-sm text-danger-fg">
          Could not save: {save.message}
        </p>
      )}
      {copy === "failed" && (
        <textarea
          readOnly
          aria-label="Layout JSON"
          value={json}
          rows={Math.min(12, json.split("\n").length)}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-card bg-surface p-2 font-mono text-xs text-fg ring-1 ring-control-outline"
        />
      )}
    </div>
  );
}
