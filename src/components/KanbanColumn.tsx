import { SelectOption, DisplayColumn } from "../types";
import { Tag } from "./Tag";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  groupValue: string;
  option: SelectOption | null; // null for "No value" column
  rows: Array<{ row: string[]; originalIndex: number }>;
  displayColumns: DisplayColumn[];
  groupByDataIdx: number;
  onDeleteRow: (rowIdx: number) => void;
  onAddRowWithValues: (values: { colIdx: number; value: string }[]) => void;
  onCardMouseDown: (e: React.MouseEvent, rowOriginalIndex: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

export function KanbanColumn({
  groupValue,
  option,
  rows,
  displayColumns,
  groupByDataIdx,
  onDeleteRow,
  onAddRowWithValues,
  onCardMouseDown,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div className="csv-db-kanban-column" data-group-value={groupValue}>
      <div className="csv-db-kanban-column-header">
        {option ? (
          <Tag value={option.value} color={option.color || "gray"} />
        ) : (
          <span className="csv-db-kanban-no-value">No value</span>
        )}
        <span className="csv-db-kanban-count">{rows.length}</span>
      </div>
      <div className="csv-db-kanban-column-body">
        {rows.map(({ row, originalIndex }) => (
          <KanbanCard
            key={originalIndex}
            row={row}
            originalIndex={originalIndex}
            displayColumns={displayColumns}
            groupByDataIdx={groupByDataIdx}
            onDeleteRow={onDeleteRow}
            onMouseDown={onCardMouseDown}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <div
        className="csv-db-kanban-new-row"
        onClick={() => {
          onAddRowWithValues(
            groupValue ? [{ colIdx: groupByDataIdx, value: groupValue }] : []
          );
        }}
      >
        + New
      </div>
    </div>
  );
}
