import { useCallback, useMemo } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { KanbanColumn } from "./KanbanColumn";
import { useCardDrag } from "../hooks/useCardDrag";
import { useBoardColumnDrag } from "../hooks/useBoardColumnDrag";
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
  onUpdateView: (view: ViewDef) => void;
  onReorderBoardColumn: (groupColIdx: number, fromIdx: number, insertAt: number) => void;
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
  onUpdateView,
  onReorderBoardColumn,
}: KanbanViewProps) {
  const groupByColumn = activeView.groupByColumn;
  const hiddenGroups = useMemo(() => activeView.hiddenGroups ?? [], [activeView.hiddenGroups]);

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

  const visibleGroups = useMemo(
    () => groups.filter((g) => !hiddenGroups.includes(g.groupValue)),
    [groups, hiddenGroups]
  );

  const handleCardMove = useCallback((rowOriginalIndex: number, targetGroupValue: string) => {
    if (!groupByInfo) return;
    onSetCell(rowOriginalIndex, groupByInfo.dataIdx, targetGroupValue);
  }, [groupByInfo, onSetCell]);

  const handleReorderColumn = useCallback(
    (fromGroupValue: string, toGroupValue: string, position: "before" | "after") => {
      if (!groupByInfo) return;
      const options = groupByInfo.col.options || [];
      const fromIdx = options.findIndex((o) => o.value === fromGroupValue);
      const toIdx = options.findIndex((o) => o.value === toGroupValue);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      let insertAt = position === "before" ? toIdx : toIdx + 1;
      if (insertAt > fromIdx) insertAt -= 1;
      onReorderBoardColumn(groupByInfo.dataIdx, fromIdx, insertAt);
    },
    [groupByInfo, onReorderBoardColumn]
  );

  const { onHeaderMouseDown } = useBoardColumnDrag({ onReorder: handleReorderColumn });

  const { onCardMouseDown, consumeJustDragged } = useCardDrag({ onCardMove: handleCardMove });

  const handleCardClickGuarded = useCallback((rowOriginalIndex: number) => {
    if (consumeJustDragged()) return;
    onCardClick(rowOriginalIndex);
  }, [consumeJustDragged, onCardClick]);

  const handleHideColumn = useCallback((groupValue: string) => {
    if (hiddenGroups.includes(groupValue)) return;
    onUpdateView({ ...activeView, hiddenGroups: [...hiddenGroups, groupValue] });
  }, [activeView, hiddenGroups, onUpdateView]);

  const handleShowColumn = useCallback((groupValue: string) => {
    const next = hiddenGroups.filter((h) => h !== groupValue);
    onUpdateView({ ...activeView, hiddenGroups: next.length > 0 ? next : undefined });
  }, [activeView, hiddenGroups, onUpdateView]);

  const handleShowAllColumns = useCallback(() => {
    onUpdateView({ ...activeView, hiddenGroups: undefined });
  }, [activeView, onUpdateView]);

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
      {hiddenGroups.length > 0 && (
        <div className="csv-db-kanban-hidden-bar">
          <span className="csv-db-kanban-hidden-label">
            {hiddenGroups.length} hidden {hiddenGroups.length === 1 ? "column" : "columns"}
          </span>
          {hiddenGroups.map((value) => (
            <button
              key={value}
              className="csv-db-kanban-hidden-chip"
              onClick={() => handleShowColumn(value)}
              title="Show column"
            >
              {value || "No value"}
            </button>
          ))}
          <button
            className="csv-db-kanban-hidden-chip csv-db-kanban-hidden-chip-all"
            onClick={handleShowAllColumns}
            title="Show all columns"
          >
            Show all
          </button>
        </div>
      )}
      <div className="csv-db-kanban-board">
        {visibleGroups.map(({ groupValue, option, rows: groupRows }) => (
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
            onHeaderMouseDown={onHeaderMouseDown}
            onHideColumn={handleHideColumn}
          />
        ))}
      </div>
    </div>
  );
}
