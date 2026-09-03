import { useState, useRef, useEffect } from "react";
import { ColumnDef } from "../types";

interface TextCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function TextCell({ value, column, onChange }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (column.type === "text") {
        inputRef.current.select();
      }
    }
  }, [editing, column.type]);

  // Sync external value changes
  useEffect(() => {
    if (!editing) {
      setEditValue(value);
    }
  }, [value, editing]);

  const handleClick = () => {
    if (!editing) {
      setEditValue(value);
      setEditing(true);
    }
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
      // revert, don't call onChange
    }
  };

  if (editing) {
    return (
      <td className={`csv-db-cell csv-db-cell-editing${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="csv-db-cell-input"
          type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </td>
    );
  }

  return (
    <td className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={handleClick}>
      {value}
    </td>
  );
}
