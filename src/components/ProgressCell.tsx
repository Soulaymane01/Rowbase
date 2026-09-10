import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ColumnDef } from "../types";
import { usePortalContainer } from "../AppContext";
import { useClickOutside } from "../hooks/useClickOutside";

function clampPercent(raw: string): number {
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseProgressPercent(raw: string): number {
  return clampPercent(raw);
}

/** Non-interactive bar/ring display for a progress value (used across views). */
export function ProgressDisplay({ column, value }: { column: ColumnDef; value: string }) {
  const percent = clampPercent(value);
  const filled = value.trim() !== "";
  return column.progressStyle === "ring"
    ? <ProgressRing percent={percent} filled={filled} />
    : <ProgressBar percent={percent} filled={filled} />;
}

interface ProgressEditorProps {
  value: number;
  onChange: (value: string) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

export function ProgressEditor({ value, onChange, onClose, anchorRect }: ProgressEditorProps) {
  const [draft, setDraft] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();

  useClickOutside([editorRef], onClose);

  const lastCommitted = useRef(String(value));
  const commit = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    setDraft(clamped);
    if (String(clamped) !== lastCommitted.current) {
      lastCommitted.current = String(clamped);
      onChange(String(clamped));
    }
  }, [onChange]);

  const editorHeight = 80;
  const spaceBelow = activeWindow.innerHeight - anchorRect.bottom;
  const placeAbove = spaceBelow < editorHeight && anchorRect.top > spaceBelow;
  const style: React.CSSProperties = placeAbove
    ? {
        position: "fixed",
        left: `${anchorRect.left}px`,
        bottom: `${activeWindow.innerHeight - anchorRect.top + 2}px`,
        width: "220px",
      }
    : {
        position: "fixed",
        left: `${anchorRect.left}px`,
        top: `${anchorRect.bottom + 2}px`,
        width: "220px",
      };

  return createPortal(
    <div ref={editorRef} className="csv-db-progress-editor" style={style}>
      <div className="csv-db-progress-editor-value">
        <input
          className="csv-db-progress-number"
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            setDraft(Math.max(0, Math.min(100, Math.round(n))));
          }}
          onBlur={(e) => commit(Number(e.target.value))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
              onClose();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
        />
        <span className="csv-db-progress-unit">%</span>
      </div>
      <input
        className="csv-db-progress-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>,
    portalContainer
  );
}

interface ProgressCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function ProgressCell({ value, column, onChange }: ProgressCellProps) {
  const [editing, setEditing] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!editing) return;
    const sync = () => {
      setAnchorRect(cellRef.current?.getBoundingClientRect() ?? null);
    };
    sync();
    const win = activeWindow;
    win.addEventListener("scroll", sync, true);
    win.addEventListener("resize", sync);
    return () => {
      win.removeEventListener("scroll", sync, true);
      win.removeEventListener("resize", sync);
    };
  }, [editing]);

  const handleClick = () => {
    if (!editing) {
      setAnchorRect(cellRef.current?.getBoundingClientRect() ?? null);
      setEditing(true);
    }
  };

  const percent = clampPercent(value);
  const isRing = column.progressStyle === "ring";

  const display = isRing ? (
    <ProgressRing percent={percent} filled={value.trim() !== ""} />
  ) : (
    <ProgressBar percent={percent} filled={value.trim() !== ""} />
  );

  return (
    <td
      ref={cellRef}
      className={`csv-db-cell csv-db-progress-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={handleClick}
      role="gridcell"
    >
      {display}
      {editing && anchorRect && (
        <ProgressEditor
          value={percent}
          anchorRect={anchorRect}
          onChange={onChange}
          onClose={() => setEditing(false)}
        />
      )}
    </td>
  );
}

export function ProgressBar({ percent, filled }: { percent: number; filled: boolean }) {
  return (
    <div className="csv-db-progress">
      <div className="csv-db-progress-bar">
        <div
          className={`csv-db-progress-fill${filled ? "" : " csv-db-progress-empty"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`csv-db-progress-label${filled ? "" : " csv-db-progress-empty"}`}>
        {filled ? `${percent}%` : "—"}
      </span>
    </div>
  );
}

export function ProgressRing({ percent, filled }: { percent: number; filled: boolean }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="csv-db-progress">
      <svg
        className="csv-db-progress-ring"
        width="20"
        height="20"
        viewBox="0 0 20 20"
      >
        <circle className="csv-db-progress-ring-track" cx="10" cy="10" r={radius} fill="none" strokeWidth="3" />
        <circle
          className={`csv-db-progress-ring-fill${filled ? "" : " csv-db-progress-empty"}`}
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 10 10)"
          strokeLinecap="round"
        />
      </svg>
      <span className={`csv-db-progress-label${filled ? "" : " csv-db-progress-empty"}`}>
        {filled ? `${percent}%` : "—"}
      </span>
    </div>
  );
}
