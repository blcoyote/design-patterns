import { useState } from "react";

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
}

type CopyState = "idle" | "copied" | "failed";

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
}: LayoutToolbarProps) {
  const [copy, setCopy] = useState<CopyState>("idle");

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
        <span role="status" className="text-sm text-fg-muted">
          {copy === "copied" && "Copied to clipboard."}
          {copy === "failed" && "Clipboard unavailable: copy the JSON below by hand."}
        </span>
      </div>
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
