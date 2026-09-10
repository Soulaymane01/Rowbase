import { DisplayColumn, SelectOption } from "../types";
import { TableRow } from "./TableRow";

interface TableBodyProps {
  rows: Array<{ row: string[]; originalIndex: number; computed?: Record<number, string> }>;
  displayColumns: DisplayColumn[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onReorderRow: (fromRowIdx: number, toRowIdx: number, position: "before" | "after") => void;
  canReorderRows: boolean;
  selectedRows: Set<number>;
  onToggleRowSelect: (rowIdx: number) => void;
  showRowNumbers: boolean;
  onAddSelectOption: (colIdx: number, option: SelectOption) => void;
  onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

export function TableBody({
  rows,
  displayColumns,
  onSetCell,
  onReorderRow,
  canReorderRows,
  selectedRows,
  onToggleRowSelect,
  showRowNumbers,
  onAddSelectOption,
  onUpdateSelectOption,
  onRemoveOptionDef,
}: TableBodyProps) {
  return (
    <tbody>
      {rows.map(({ row, originalIndex, computed }, displayIdx) => (
        <TableRow
          key={originalIndex}
          rowIdx={originalIndex}
          row={row}
          computed={computed}
          displayColumns={displayColumns}
          onSetCell={onSetCell}
          onReorderRow={onReorderRow}
          canReorderRows={canReorderRows}
          selected={selectedRows.has(originalIndex)}
          onToggleRowSelect={onToggleRowSelect}
          showRowNumbers={showRowNumbers}
          rowNumber={displayIdx + 1}
          onAddSelectOption={onAddSelectOption}
          onUpdateSelectOption={onUpdateSelectOption}
          onRemoveOptionDef={onRemoveOptionDef}
        />
      ))}
    </tbody>
  );
}
