import { useState, useRef } from "react";
import { ColumnDef, SelectOption } from "../types";
import { splitMultiSelect, joinMultiSelect } from "../csv-parser";
import { Tag } from "./Tag";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

interface MultiSelectCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
  onAddOption: (option: SelectOption) => void;
  onUpdateOption: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
}

export function MultiSelectCell({ value, column, onChange, onAddOption, onUpdateOption, onRemoveOptionDef }: MultiSelectCellProps) {
  const [open, setOpen] = useState(false);
  const tdRef = useRef<HTMLTableCellElement>(null);

  const values = splitMultiSelect(value);

  const handleClick = () => {
    if (!open) {
      setOpen(true);
    }
  };

  const handleCommit = (newValues: string[]) => {
    onChange(joinMultiSelect(newValues));
  };

  return (
    <td className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={handleClick} ref={tdRef}>
      {values.map((v) => {
        const option = column.options?.find((o) => o.value === v);
        return <Tag key={v} value={v} color={option?.color || "gray"} />;
      })}
      {open && tdRef.current && (
        <MultiSelectDropdown
          column={column}
          currentValues={values}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onCommit={handleCommit}
          onCreateOption={onAddOption}
          onUpdateOption={onUpdateOption}
          onRemoveOptionDef={onRemoveOptionDef}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
