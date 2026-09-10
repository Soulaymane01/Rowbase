import { ColumnDef, SelectOption } from "../types";
import { CheckboxCell } from "./CheckboxCell";
import { TextCell } from "./TextCell";
import { SelectCell } from "./SelectCell";
import { MultiSelectCell } from "./MultiSelectCell";
import { NoteCell } from "./NoteCell";
import { TitleCell } from "./TitleCell";
import { RelationCell } from "./RelationCell";
import { ProgressCell } from "./ProgressCell";

interface CellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
  onAddOption: (option: SelectOption) => void;
  onUpdateOption: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
}

export function Cell({ value, column, onChange, onAddOption, onUpdateOption, onRemoveOptionDef }: CellProps) {
  if (column.type === "checkbox") {
    return (
      <td className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`} role="gridcell">
        <CheckboxCell value={value} onChange={onChange} column={column} />
      </td>
    );
  }

  if (column.type === "select") {
    return (
      <SelectCell
        value={value}
        column={column}
        onChange={onChange}
        onAddOption={onAddOption}
        onUpdateOption={onUpdateOption}
        onRemoveOptionDef={onRemoveOptionDef}
      />
    );
  }

  if (column.type === "multiselect") {
    return (
      <MultiSelectCell
        value={value}
        column={column}
        onChange={onChange}
        onAddOption={onAddOption}
        onUpdateOption={onUpdateOption}
        onRemoveOptionDef={onRemoveOptionDef}
      />
    );
  }

  if (column.type === "note") {
    return <NoteCell value={value} column={column} onChange={onChange} />;
  }

  if (column.type === "title") {
    return <TitleCell value={value} column={column} onChange={onChange} />;
  }

  if (column.type === "relation") {
    return <RelationCell value={value} column={column} onChange={onChange} />;
  }

  if (column.type === "progress") {
    return <ProgressCell value={value} column={column} onChange={onChange} />;
  }

  if (column.type === "formula" || column.type === "rollup") {
    return (
      <td className={`csv-db-cell csv-db-cell-computed${column.wrapContent ? " csv-db-cell-wrap" : ""}`} role="gridcell">
        <span className="csv-db-cell-computed-value">{value ?? ""}</span>
      </td>
    );
  }

  // text, number, date
  return (
    <TextCell value={value} column={column} onChange={onChange} />
  );
}
