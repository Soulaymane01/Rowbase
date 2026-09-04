import { useCallback, useMemo } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { KanbanColumn } from "./KanbanColumn";
import { useCardDrag } from "../hooks/useCardDrag";
import { groupRowsBySelect } from "../query/group";
import { QueryResultRow } from "../query/record";

interface KanbanViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onAddRowWithValues: (values: { colIdx: number; value: string }[]) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

export function KanbanView({
  rows,
  columns,
  displayColumns,
  activeView,
  onSetCell,
  onDeleteRow,
  onAddRowWithValues,
  onCardClick,
}: KanbanViewProps) {
  const groupByColumn = activeView.groupByColumn;

  // Resolve groupByColumn to column def + dataIdx
  const groupByInfo = useMemo(() => {
    if (!groupByColumn) return null;
    const dataIdx = columns.findIndex((c) => c.name === groupByColumn);
    if (dataIdx === -1) return null;
    const col = columns[dataIdx];
    if (col.type !== "select") return null;
    return { col, dataIdx };
  }, [columns, groupByColumn]);

  // Partition rows into groups
  const groups = useMemo(() => {
    return groupRowsBySelect(rows, columns, groupByColumn);
  }, [rows, columns, groupByColumn]);

  const handleCardMove = useCallback((rowOriginalIndex: number, targetGroupValue: string) => {
    if (!groupByInfo) return;
    onSetCell(rowOriginalIndex, groupByInfo.dataIdx, targetGroupValue);
  }, [groupByInfo, onSetCell]);

  const { onCardMouseDown, consumeJustDragged } = useCardDrag({ onCardMove: handleCardMove });

  const handleCardClickGuarded = useCallback((rowOriginalIndex: number) => {
    if (consumeJustDragged()) return;
    onCardClick(rowOriginalIndex);
  }, [consumeJustDragged, onCardClick]);

  if (!groupByInfo) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="5" height="18" rx="1"/>
            <rect x="10" y="3" width="5" height="12" rx="1"/>
            <rect x="17" y="3" width="5" height="15" rx="1"/>
          </svg>
        </div>
        <div className="csv-db-empty-title">Select a group column</div>
        <div className="csv-db-empty-desc">Choose a Select column to group by in the view menu.</div>
      </div>
    );
  }

  return (
    <div className="csv-db-kanban-scroll">
      <div className="csv-db-kanban-board">
        {groups.map(({ groupValue, option, rows: groupRows }) => (
          <KanbanColumn
            key={groupValue}
            groupValue={groupValue}
            option={option}
            rows={groupRows}
            displayColumns={displayColumns}
            groupByDataIdx={groupByInfo.dataIdx}
            onDeleteRow={onDeleteRow}
            onAddRowWithValues={onAddRowWithValues}
            onCardMouseDown={onCardMouseDown}
            onCardClick={handleCardClickGuarded}
          />
        ))}
      </div>
    </div>
  );
}
