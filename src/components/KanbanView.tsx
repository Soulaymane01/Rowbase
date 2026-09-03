import { useCallback, useMemo } from "react";
import { ColumnDef, DisplayColumn, SelectOption, ViewDef } from "../types";
import { KanbanColumn } from "./KanbanColumn";
import { useCardDrag } from "../hooks/useCardDrag";

interface KanbanViewProps {
  rows: Array<{ row: string[]; originalIndex: number }>;
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
    if (!groupByInfo) return [];

    const options = groupByInfo.col.options || [];
    const groupMap = new Map<string, Array<{ row: string[]; originalIndex: number }>>();

    // Initialize groups in option order
    for (const opt of options) {
      groupMap.set(opt.value, []);
    }
    // Always have a "No value" group
    groupMap.set("", []);

    for (const entry of rows) {
      const cellValue = entry.row[groupByInfo.dataIdx] || "";
      if (!groupMap.has(cellValue)) {
        // Value exists in data but not in options (orphaned) — add to "No value"
        const noValue = groupMap.get("")!;
        noValue.push(entry);
      } else {
        groupMap.get(cellValue)!.push(entry);
      }
    }

    // Build ordered group list: options first, then "No value"
    const result: Array<{
      groupValue: string;
      option: SelectOption | null;
      rows: Array<{ row: string[]; originalIndex: number }>;
    }> = [];

    for (const opt of options) {
      result.push({
        groupValue: opt.value,
        option: opt,
        rows: groupMap.get(opt.value)!,
      });
    }

    const noValueRows = groupMap.get("")!;
    if (noValueRows.length > 0) {
      result.push({
        groupValue: "",
        option: null,
        rows: noValueRows,
      });
    }

    return result;
  }, [rows, groupByInfo]);

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
      <div className="csv-db-kanban-empty">
        <p>Select a column to group by in the view menu.</p>
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
