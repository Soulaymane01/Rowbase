import { useMemo, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp } from "../AppContext";
import { NoteDropdown } from "./NoteDropdown";
import { getNoteDisplayName, notePathExists, openNoteValue } from "../note-utils";

interface NoteCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function NoteCell({ value, column, onChange }: NoteCellProps) {
  const [open, setOpen] = useState(false);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const app = useApp();
  const exists = useMemo(() => notePathExists(app, value), [app, value]);

  const handleClick = () => {
    if (!open) {
      setOpen(true);
    }
  };

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
  };

  const basename = value ? getNoteDisplayName(value) : "";

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      void openNoteValue(app, value);
    }
  };

  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={handleClick}
      ref={tdRef}
    >
      {value && (
        <span className="csv-db-note-cell-content">
          <span className="csv-db-note-cell-name">{basename}</span>
          <button
            className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
            onClick={handleOpen}
          >
            {exists ? "OPEN" : "CREATE"}
          </button>
        </span>
      )}
      {open && tdRef.current && (
        <NoteDropdown
          currentValue={value}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
