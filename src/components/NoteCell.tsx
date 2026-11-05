import { useMemo, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp, useDatabaseModel, useDatabasePath } from "../AppContext";
import { NoteDropdown } from "./NoteDropdown";
import {
  applyNoteFolder,
  getNoteDisplayName,
  notePathExists,
  openNoteValue,
  resolveNoteFolder,
  splitNoteValues,
} from "../note-utils";
import { noteOpenModeForClick, showNoteContextMenu } from "../note-actions";

interface NoteCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function NoteCell({ value, column, onChange }: NoteCellProps) {
  const [open, setOpen] = useState(false);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const app = useApp();
  const databasePath = useDatabasePath();
  const databaseModel = useDatabaseModel();
  const values = useMemo(() => splitNoteValues(value, column), [value, column]);
  const defaultFolder = useMemo(() => {
    const titleCol = databaseModel?.columns.find(
      (c) => c.type === "title" && c.titleNoteEnabled !== false
    );
    return resolveNoteFolder(column.noteFolder || titleCol?.titleNoteFolder || "", databasePath);
  }, [column.noteFolder, databaseModel, databasePath]);
  const resolvedValue = useMemo(() => applyNoteFolder(value, defaultFolder), [value, defaultFolder]);
  const exists = value ? notePathExists(app, resolvedValue) : false;

  const handleClick = () => {
    if (!open) {
      setOpen(true);
    }
  };

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
  };

  const handleOpen = (e: React.MouseEvent, noteValue: string) => {
    e.stopPropagation();
    if (!noteValue) return;
    void openNoteValue(app, applyNoteFolder(noteValue, defaultFolder), {
      mode: noteOpenModeForClick(e),
    });
  };

  const handleOpenMenu = (e: React.MouseEvent, noteValue: string) => {
    if (!noteValue) return;
    const target = applyNoteFolder(noteValue, defaultFolder);
    showNoteContextMenu(e, (mode) => void openNoteValue(app, target, { mode }));
  };
  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={handleClick}
      onContextMenu={value && !column.noteMultiple ? (e) => handleOpenMenu(e, value) : undefined}
      ref={tdRef}
    >
      {column.noteMultiple ? (
        values.length > 0 && (
          <span className="csv-db-note-cell-content csv-db-note-cell-multi">
            {values.map((noteValue) => (
              <span
                key={noteValue}
                className="csv-db-note-pill"
                title={noteValue}
                onClick={(e) => handleOpen(e, noteValue)}
                onContextMenu={(e) => handleOpenMenu(e, noteValue)}
              >
                {getNoteDisplayName(noteValue)}
              </span>
            ))}
          </span>
        )
      ) : (
        value && (
          <span className="csv-db-note-cell-content">
            <span className="csv-db-note-cell-name">{getNoteDisplayName(value)}</span>
            <button
              className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
              onClick={(e) => handleOpen(e, value)}
              onContextMenu={(e) => handleOpenMenu(e, value)}
              title={`${exists ? "Open" : "Create"} note · Ctrl/Cmd-click or right-click to open to the right`}
            >
              {exists ? "OPEN" : "CREATE"}
            </button>
          </span>
        )
      )}
      {open && tdRef.current && (
        <NoteDropdown
          currentValue={value}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          defaultFolder={defaultFolder}
          multiple={column.noteMultiple === true}
        />
      )}
    </td>
  );
}
