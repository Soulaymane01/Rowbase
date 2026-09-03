import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp, usePortalContainer } from "../AppContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { normalizeNoteValue } from "../note-utils";

interface NoteDropdownProps {
  currentValue: string;
  anchorRect: DOMRect;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function NoteDropdown({
  currentValue,
  anchorRect,
  onSelect,
  onClose,
}: NoteDropdownProps) {
  const [search, setSearch] = useState(currentValue);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerDownInsideRef = useRef(false);
  const app = useApp();
  const portalContainer = usePortalContainer();

  const allFiles = useMemo(() => {
    return app.vault.getMarkdownFiles().map((f) => ({
      path: f.path,
      basename: f.basename,
      folder: f.parent?.path || "",
    }));
  }, [app.vault]);

  const candidatePath = normalizeNoteValue(search);
  const normalizedCurrentValue = normalizeNoteValue(currentValue);
  const lower = candidatePath.toLowerCase();
  const filtered = useMemo(() => {
    const results = allFiles.filter(
      (f) =>
        (f.basename.toLowerCase().includes(lower) ||
          f.path.toLowerCase().includes(lower))
    );
    return results.slice(0, 50);
  }, [allFiles, lower]);

  const handleCommitPath = useCallback(() => {
    if (!candidatePath) return;
    const matchingFile = allFiles.find((file) => file.path.toLowerCase() === lower);
    onSelect(matchingFile?.path || candidatePath);
  }, [allFiles, candidatePath, lower, onSelect]);

  const handleDismiss = useCallback(() => {
    if (candidatePath === normalizedCurrentValue) {
      onClose();
      return;
    }
    if (candidatePath) {
      handleCommitPath();
      return;
    }
    if (currentValue) {
      onSelect("");
      return;
    }
    onClose();
  }, [candidatePath, currentValue, handleCommitPath, normalizedCurrentValue, onClose, onSelect]);

  useClickOutside([dropdownRef], handleDismiss);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return createPortal(
    <div
      ref={dropdownRef}
      className={`csv-db-dropdown csv-db-note-dropdown${filtered.length === 0 ? " is-empty" : ""}`}
      onMouseDownCapture={() => {
        pointerDownInsideRef.current = true;
      }}
      onMouseUpCapture={() => {
        pointerDownInsideRef.current = false;
      }}
      style={{
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
        width: `${anchorRect.width}px`,
      }}
    >
      <div
        className="csv-db-dropdown-input-area"
        onClick={() => {
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          className="csv-db-dropdown-search"
          placeholder="Type a name or search notes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const nextTarget = e.relatedTarget as Node | null;
            if (pointerDownInsideRef.current) return;
            if (nextTarget && dropdownRef.current?.contains(nextTarget)) return;
            handleDismiss();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommitPath();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        {search && (
          <button
            className="csv-db-note-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSearch("");
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>
      {filtered.length > 0 && (
        <div className="csv-db-dropdown-list">
          {filtered.map((file) => (
            <div
              key={file.path}
              className="csv-db-dropdown-item"
              onClick={() => onSelect(file.path)}
            >
              <span className="csv-db-note-item-icon">📄</span>
              <span className="csv-db-note-item-name">{file.basename}</span>
              {file.folder && (
                <span className="csv-db-note-item-path">{file.folder}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>,
    portalContainer
  );
}
