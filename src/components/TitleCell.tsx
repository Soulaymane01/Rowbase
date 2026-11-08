import { useEffect, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp, useDatabasePath } from "../AppContext";
import { openTitleNote, titleNoteExists } from "../title-utils";
import { openTitleFolder, titleFolderExists } from "../folder-utils";
import { noteOpenModeForClick, showNoteContextMenu } from "../note-actions";
import { keepEditorVisible } from "../editor-focus";

interface TitleCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function TitleCell({ value, column, onChange }: TitleCellProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const app = useApp();
  const databasePath = useDatabasePath();
  const linkToNote = column.titleNoteEnabled !== false;
  const exists = linkToNote && titleNoteExists(app, value, column, databasePath);
  const linkToFolder = column.titleFolderEnabled === true;
  const folderExists = linkToFolder && titleFolderExists(app, value, column, databasePath);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
    keepEditorVisible(input);
  }, [editing]);

  const startEditing = () => {
    cancelledRef.current = false;
    setEditing(true);
  };

  const commit = () => {
    const next = inputRef.current?.value ?? value;
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    onChange(next);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openTitleNote(app, value, column, databasePath, { mode: noteOpenModeForClick(e) });
  };

  const handleOpenMenu = (e: React.MouseEvent) => {
    showNoteContextMenu(e, (mode) => void openTitleNote(app, value, column, databasePath, { mode }));
  };

  const handleOpenFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openTitleFolder(app, value, column, databasePath);
  };

  if (editing) {
    return (
      <td className={`csv-db-cell csv-db-cell-editing${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="csv-db-cell-input"
          type="text"
          // Uncontrolled while editing: on mobile, re-applying a controlled
          // value during IME composition resets the caret (text arrives
          // reversed). The value is read on blur/Enter instead.
          defaultValue={value}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              cancelledRef.current = true;
              setEditing(false);
            }
          }}
        />
      </td>
    );
  }

  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={startEditing}
    >
      {value && (
        <span className="csv-db-note-cell-content">
          <span className="csv-db-note-cell-name">{value}</span>
          {linkToNote && (
            <button
              className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
              onClick={handleOpen}
              onContextMenu={handleOpenMenu}
              title={`${exists ? "Open" : "Create"} note · Ctrl/Cmd-click or right-click to open to the right`}
            >
              {exists ? "OPEN" : "CREATE"}
            </button>
          )}
          {linkToFolder && (
            <button
              className={`csv-db-note-open-btn${folderExists ? "" : " is-create"}`}
              onClick={handleOpenFolder}
            >
              {folderExists ? "FOLDER" : "CREATE"}
            </button>
          )}
        </span>
      )}
    </td>
  );
}
