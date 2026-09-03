import { DisplayColumn, SelectOption } from "../types";
import { TableRow } from "./TableRow";

interface TableBodyProps {
  rows: Array<{ row: string[]; originalIndex: number }>;
  displayColumns: DisplayColumn[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onReorderRow: (fromRowIdx: number, toRowIdx: number, position: "before" | "after") => void;
  canReorderRows: boolean;
  onAddSelectOption: (colIdx: number, option: SelectOption) => void;
  onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

export function TableBody({
  rows,
  displayColumns,
  onSetCell,
  onDeleteRow,
  onReorderRow,
  canReorderRows,
  onAddSelectOption,
  onUpdateSelectOption,
  onRemoveOptionDef,
}: TableBodyProps) {
  return (
    <tbody>
      {rows.map(({ row, originalIndex }) => (
        <TableRow
          key={originalIndex}
          rowIdx={originalIndex}
          row={row}
          displayColumns={displayColumns}
          onSetCell={onSetCell}
          onDeleteRow={onDeleteRow}
          onReorderRow={onReorderRow}
          canReorderRows={canReorderRows}
          onAddSelectOption={onAddSelectOption}
          onUpdateSelectOption={onUpdateSelectOption}
          onRemoveOptionDef={onRemoveOptionDef}
        />
      ))}
    </tbody>
  );
}
