import { useState, useRef } from "react";
import { ColumnDef, SelectOption } from "../types";
import { Tag } from "./Tag";
import { SelectDropdown } from "./SelectDropdown";

interface SelectCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
  onAddOption: (option: SelectOption) => void;
  onUpdateOption: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
}

export function SelectCell({ value, column, onChange, onAddOption, onUpdateOption, onRemoveOptionDef }: SelectCellProps) {
  const [open, setOpen] = useState(false);
  const tdRef = useRef<HTMLTableCellElement>(null);

  const handleClick = () => {
    if (!open) {
      setOpen(true);
    }
  };

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
  };

  const option = column.options?.find((o) => o.value === value);

  return (
    <td className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`} onClick={handleClick} ref={tdRef}>
      {value && (
        <Tag value={value} color={option?.color || "gray"} />
      )}
      {open && tdRef.current && (
        <SelectDropdown
          column={column}
          currentValue={value}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onSelect={handleSelect}
          onCreateOption={onAddOption}
          onUpdateOption={onUpdateOption}
          onRemoveOptionDef={onRemoveOptionDef}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
