import { DisplayColumn, SelectOption } from "../types";
import { KanbanField } from "./KanbanField";

interface KanbanCardProps {
  row: string[];
  originalIndex: number;
  computed?: Record<number, string>;
  displayColumns: DisplayColumn[];
  groupByDataIdx: number;
  onDeleteRow: (rowIdx: number) => void;
  onMouseDown: (e: React.MouseEvent, rowOriginalIndex: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onAddOption: (colIdx: number, option: SelectOption) => void;
  onUpdateOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

export function KanbanCard({
  row,
  originalIndex,
  computed,
  displayColumns,
  groupByDataIdx,
  onDeleteRow,
  onMouseDown,
  onCardClick,
  onSetCell,
  onAddOption,
  onUpdateOption,
  onRemoveOptionDef,
}: KanbanCardProps) {
  const visibleColumns = displayColumns.filter((dc) => dc.dataIdx !== groupByDataIdx);
  const titleCol = visibleColumns[0];
  const propertyColumns = visibleColumns.slice(1);
  const getVal = (dataIdx: number) => computed?.[dataIdx] ?? row[dataIdx] ?? "";

  const titleIsPlainText = titleCol && (titleCol.col.type === "text" || titleCol.col.type === "title" || titleCol.col.type === "number" || titleCol.col.type === "date");
  const titleValue = titleCol ? getVal(titleCol.dataIdx) : "";

  const fieldHandlers = {
    onSetCell,
    onAddOption,
    onUpdateOption,
    onRemoveOptionDef,
  };

  return (
    <div
      className="csv-db-kanban-card"
      data-row-index={originalIndex}
      onMouseDown={(e) => onMouseDown(e, originalIndex)}
      onClick={() => onCardClick(originalIndex)}
    >
      {titleIsPlainText ? (
        <div className="csv-db-kanban-card-title">{titleValue || "Untitled"}</div>
      ) : titleCol && titleValue ? (
        <div className="csv-db-kanban-card-prop">
          <KanbanField
            column={titleCol.col}
            dataIdx={titleCol.dataIdx}
            value={titleValue}
            rowIdx={originalIndex}
            {...fieldHandlers}
          />
        </div>
      ) : (
        <div className="csv-db-kanban-card-title">Untitled</div>
      )}
      {propertyColumns.map(({ col, dataIdx }) => {
        const value = getVal(dataIdx);
        if (!value) return null;
        return (
          <div key={col.name} className="csv-db-kanban-card-prop">
            <KanbanField
              column={col}
              dataIdx={dataIdx}
              value={value}
              rowIdx={originalIndex}
              {...fieldHandlers}
            />
          </div>
        );
      })}
      <div
        className="csv-db-kanban-card-delete"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRow(originalIndex);
        }}
      >
        ✕
      </div>
    </div>
  );
}
