import { useState, useRef, useEffect } from "react";
import { ColumnDef } from "../types";
import { WikilinkText } from "./WikilinkText";
import { keepEditorVisible } from "../editor-focus";

interface TextCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function TextCell({ value, column, onChange }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (column.type === "text") {
      input.select();
    }
    keepEditorVisible(input);
  }, [editing, column.type]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      cancelledRef.current = true;
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <td className={`csv-db-cell csv-db-cell-editing${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="csv-db-cell-input"
          type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
          // Uncontrolled while editing so mobile IME composition can't reset
          // the caret (which made text arrive reversed).
          defaultValue={value}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </td>
    );
  }

  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={startEditing}
      onDoubleClick={startEditing}
    >
      <WikilinkText value={value} />
    </td>
  );
}
