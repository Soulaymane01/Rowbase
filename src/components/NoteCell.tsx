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
    void openNoteValue(app, applyNoteFolder(noteValue, defaultFolder));
  };
  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={handleClick}
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
