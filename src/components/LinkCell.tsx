import { useEffect, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp } from "../AppContext";
import { getNoteDisplayName, openNoteValue } from "../note-utils";

interface LinkCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

// The only URL scheme literal Rowbase builds. Bare domains typed by the user
// are given an HTTPS prefix before being handed to window.open, which lets
// Obsidian/Electron pass the link to the OS default browser. Rowbase never
// fetches this value. The `browserHandoffPrefix` identifier is the marker the
// offline runtime audit (test-offline-baseline.mjs) requires beside this
// literal, so any other URL literal elsewhere still fails the audit.
const browserHandoffPrefix = "https://";

export function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return browserHandoffPrefix + trimmed;
}

export function openExternalUrl(value: string): void {
  const url = normalizeExternalUrl(value);
  if (!url) return;
  window.open(url, "_blank");
}

export function LinkCell({ value, column, onChange }: LinkCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const app = useApp();

  const isUrl = column.type === "url";

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      setEditValue(value);
    }
  }, [value, editing]);

  const startEditing = () => {
    setEditValue(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    onChange(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) {
      startEditing();
      return;
    }
    if (isUrl) {
      openExternalUrl(value);
    } else {
      void openNoteValue(app, value);
    }
  };

  if (editing) {
    return (
      <td className={`csv-db-cell csv-db-cell-editing${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="csv-db-cell-input"
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </td>
    );
  }

  const display = value ? (isUrl ? value : getNoteDisplayName(value)) : "";

  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onDoubleClick={startEditing}
    >
      <span className="csv-db-link-cell">
        {value ? (
          <a
            className="csv-db-link-cell-name"
            href={isUrl ? normalizeExternalUrl(value) : undefined}
            title={isUrl ? value : `Open ${value}`}
            onClick={(e) => {
              e.preventDefault();
              handleOpen(e);
            }}
          >
            {display}
          </a>
        ) : (
          <span className="csv-db-link-cell-empty" onClick={startEditing}>Empty</span>
        )}
        <button
          className="csv-db-link-cell-edit"
          title="Edit"
          aria-label="Edit"
          onClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5 12.5 4.5 4.5 12.5 1 13 1.5 9.5z" />
          </svg>
        </button>
      </span>
    </td>
  );
}
