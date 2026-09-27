import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp, usePortalContainer } from "../AppContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { applyNoteFolder, normalizeNoteValue } from "../note-utils";
import { joinMultiSelect, splitMultiSelect } from "../csv-parser";
import { useDropdownFlip, dropdownStyle } from "../hooks/useDropdownFlip";

interface NoteDropdownProps {
  currentValue: string;
  anchorRect: DOMRect;
  onSelect: (value: string) => void;
  onClose: () => void;
  defaultFolder?: string;
  multiple?: boolean;
}

export function NoteDropdown({
  currentValue,
  anchorRect,
  onSelect,
  onClose,
  defaultFolder = "",
  multiple = false,
}: NoteDropdownProps) {
  const [search, setSearch] = useState(multiple ? "" : currentValue);
  const [selected, setSelected] = useState<string[]>(() =>
    multiple ? splitMultiSelect(currentValue) : []
  );
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

  const hasExactMatch = useMemo(
    () => allFiles.some((file) => file.path.toLowerCase() === lower),
    [allFiles, lower]
  );

  const handleCommitPath = useCallback(() => {
    if (!candidatePath) return;
    const matchingFile = allFiles.find((file) => file.path.toLowerCase() === lower);
    const value = matchingFile?.path || applyNoteFolder(candidatePath, defaultFolder);
    onSelect(value);
  }, [allFiles, candidatePath, lower, defaultFolder, onSelect]);

  const commitMultiple = useCallback((values: string[]) => {
    onSelect(joinMultiSelect(values.map((v) => v.trim()).filter(Boolean)));
  }, [onSelect]);

  const addTypedNote = useCallback(() => {
    if (!candidatePath) return;
    setSelected((prev) => {
      const next = [...prev, applyNoteFolder(candidatePath, defaultFolder)];
      return next;
    });
    setSearch("");
    inputRef.current?.focus();
  }, [candidatePath, defaultFolder]);

  const handleDismiss = useCallback(() => {
    if (multiple) {
      const joined = joinMultiSelect(selected);
      if (joined !== currentValue) commitMultiple(selected);
      else onClose();
      return;
    }
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
  }, [multiple, selected, currentValue, commitMultiple, candidatePath, normalizedCurrentValue, handleCommitPath, onClose, onSelect]);

  useClickOutside([dropdownRef], handleDismiss);
  const placement = useDropdownFlip(anchorRect, dropdownRef);

  useEffect(() => {
    inputRef.current?.focus();
    if (!multiple) {
      inputRef.current?.select();
    }
  }, [multiple]);

  const toggleSelected = (path: string) => {
    setSelected((prev) =>
      prev.some((v) => v.toLowerCase() === path.toLowerCase())
        ? prev.filter((v) => v.toLowerCase() !== path.toLowerCase())
        : [...prev, path]
    );
  };

  const isSelected = (path: string) =>
    selected.some((v) => v.toLowerCase() === path.toLowerCase());

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
      style={dropdownStyle(anchorRect, placement)}
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
              if (multiple) {
                if (candidatePath && !hasExactMatch) addTypedNote();
                else if (candidatePath && hasExactMatch) {
                  const match = allFiles.find((f) => f.path.toLowerCase() === lower);
                  if (match) toggleSelected(match.path);
                  setSearch("");
                } else {
                  commitMultiple(selected);
                }
              } else {
                handleCommitPath();
              }
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
      {multiple && selected.length > 0 && (
        <div className="csv-db-note-selected-bar">
          {selected.map((value) => (
            <span key={value} className="csv-db-note-selected-pill" title={value}>
              <span className="csv-db-note-selected-name">
                {value.replace(/\.md$/, "").split("/").pop()}
              </span>
              <button
                className="csv-db-note-selected-remove"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelected(value);
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {multiple && candidatePath && !hasExactMatch && (
        <div className="csv-db-dropdown-item csv-db-note-create-item" onClick={addTypedNote}>
          <span className="csv-db-note-item-icon">＋</span>
          <span className="csv-db-note-item-name">
            Add "{applyNoteFolder(candidatePath, defaultFolder)}"
          </span>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="csv-db-dropdown-list">
          {filtered.map((file) => (
            <div
              key={file.path}
              className={`csv-db-dropdown-item${multiple && isSelected(file.path) ? " is-selected" : ""}`}
              onClick={() => {
                if (multiple) toggleSelected(file.path);
                else onSelect(file.path);
              }}
            >
              {multiple ? (
                <span className="csv-db-note-item-check" aria-hidden="true">
                  {isSelected(file.path) ? "✓" : ""}
                </span>
              ) : (
                <span className="csv-db-note-item-icon">📄</span>
              )}
              <span className="csv-db-note-item-name">{file.basename}</span>
              {file.folder && (
                <span className="csv-db-note-item-path">{file.folder}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {multiple && (
        <div className="csv-db-note-dropdown-footer">
          <button
            className="csv-db-modal-btn csv-db-modal-btn-primary csv-db-note-done-btn"
            onClick={() => commitMultiple(selected)}
          >
            Done
          </button>
        </div>
      )}
    </div>,
    portalContainer
  );
}
