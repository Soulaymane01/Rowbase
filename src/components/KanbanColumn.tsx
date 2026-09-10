import { SelectOption, DisplayColumn } from "../types";
import { TAG_COLORS } from "../constants";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  groupValue: string;
  option: SelectOption | null; // null for "No value" column
  rows: Array<{ row: string[]; originalIndex: number; computed?: Record<number, string> }>;
  displayColumns: DisplayColumn[];
  groupByDataIdx: number;
  onDeleteRow: (rowIdx: number) => void;
  onAddRowWithValues: (values: { colIdx: number; value: string }[]) => void;
  onCardMouseDown: (e: React.MouseEvent, rowOriginalIndex: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onHideColumn: (groupValue: string) => void;
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
  onHeaderMouseDown,
  onHideColumn,
}: KanbanColumnProps) {
  const dotColor = option?.color ? TAG_COLORS[option.color]?.bg : undefined;

  return (
    <div className="csv-db-kanban-column" data-group-value={groupValue}>
      <div
        className={`csv-db-kanban-column-header${groupValue ? " csv-db-kanban-column-header-draggable" : ""}`}
        onMouseDown={onHeaderMouseDown}
        title={groupValue ? "Drag to reorder" : undefined}
      >
        {option ? (
          <>
            <span
              className="csv-db-kanban-title-dot"
              style={{ background: dotColor || "var(--text-faint)" }}
              aria-hidden="true"
            />
            <span className="csv-db-kanban-column-title">{option.value}</span>
          </>
        ) : (
          <span className="csv-db-kanban-column-title csv-db-kanban-title-muted">No value</span>
        )}
        <span className="csv-db-kanban-count">{rows.length}</span>
        <button
          className="csv-db-kanban-hide-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onHideColumn(groupValue);
          }}
          title="Hide column"
          aria-label="Hide column"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1.5 7C1.5 7 4 3.5 7 3.5C10 3.5 12.5 7 12.5 7C12.5 7 10 10.5 7 10.5C4 10.5 1.5 7 1.5 7Z" />
            <line x1="2.5" y1="2" x2="11.5" y2="12" />
          </svg>
        </button>
      </div>
      <div className="csv-db-kanban-column-body">
        {rows.map(({ row, originalIndex, computed }) => (
          <KanbanCard
            key={originalIndex}
            row={row}
            originalIndex={originalIndex}
            computed={computed}
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
