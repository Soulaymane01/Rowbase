import { useEffect, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp, useDatabasePath } from "../AppContext";
import { openTitleNote, titleNoteExists } from "../title-utils";
import { openTitleFolder, titleFolderExists } from "../folder-utils";

interface TitleCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function TitleCell({ value, column, onChange }: TitleCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const app = useApp();
  const databasePath = useDatabasePath();
  const linkToNote = column.titleNoteEnabled !== false;
  const exists = linkToNote && titleNoteExists(app, value, column, databasePath);
  const linkToFolder = column.titleFolderEnabled === true;
  const folderExists = linkToFolder && titleFolderExists(app, value, column, databasePath);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      setEditValue(value);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    onChange(editValue);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openTitleNote(app, value, column, databasePath);
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
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
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
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
    >
      {value && (
        <span className="csv-db-note-cell-content">
          <span className="csv-db-note-cell-name">{value}</span>
          {linkToNote && (
            <button
              className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
              onClick={handleOpen}
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
