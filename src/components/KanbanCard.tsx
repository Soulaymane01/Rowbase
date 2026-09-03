import { ColumnDef, DisplayColumn } from "../types";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { RelationPill } from "./RelationPill";
import { Tag } from "./Tag";

interface KanbanCardProps {
  row: string[];
  originalIndex: number;
  displayColumns: DisplayColumn[];
  groupByDataIdx: number;
  onDeleteRow: (rowIdx: number) => void;
  onMouseDown: (e: React.MouseEvent, rowOriginalIndex: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function renderCardProperty(value: string, col: ColumnDef): React.ReactNode {
  if (!value) return null;

  if (col.type === "select") {
    const opt = col.options?.find((o) => o.value === value);
    return <Tag value={value} color={opt?.color || "gray"} />;
  }

  if (col.type === "multiselect") {
    const values = splitMultiSelect(value);
    if (values.length === 0) return null;
    return (
      <span className="csv-db-kanban-card-tags">
        {values.map((v) => {
          const opt = col.options?.find((o) => o.value === v);
          return <Tag key={v} value={v} color={opt?.color || "gray"} />;
        })}
      </span>
    );
  }

  if (col.type === "checkbox") {
    const checked = value === "true";
    return (
      <span className="csv-db-kanban-card-checkbox">
        <div className={`csv-db-checkbox ${checked ? "is-checked" : ""}`}>
          {checked && <span className="csv-db-checkbox-icon">✓</span>}
        </div>
        <span className="csv-db-kanban-card-checkbox-label">{col.name}</span>
      </span>
    );
  }

  if (col.type === "note") {
    const basename = value.replace(/\.md$/, "").split("/").pop();
    return (
      <span className="csv-db-kanban-card-note">
        <span className="csv-db-note-cell-icon">📄</span>
        <span>{basename}</span>
      </span>
    );
  }

  if (col.type === "relation") {
    const values = splitRelationValue(value, col);
    if (values.length === 0) return null;
    return (
      <span className="csv-db-kanban-card-tags">
        {values.map((v) => (
          <RelationPill key={v} value={v} />
        ))}
      </span>
    );
  }

  return <span>{value}</span>;
}

export function KanbanCard({
  row,
  originalIndex,
  displayColumns,
  groupByDataIdx,
  onDeleteRow,
  onMouseDown,
  onCardClick,
}: KanbanCardProps) {
  const visibleColumns = displayColumns.filter((dc) => dc.dataIdx !== groupByDataIdx);
  const titleCol = visibleColumns[0];
  const propertyColumns = visibleColumns.slice(1);

  // Title: render with type awareness — use plain text for text-like types, Tag for select types
  const titleIsPlainText = titleCol && (titleCol.col.type === "text" || titleCol.col.type === "title" || titleCol.col.type === "number" || titleCol.col.type === "date");
  const titleValue = titleCol ? row[titleCol.dataIdx] : "";

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
        <div className="csv-db-kanban-card-prop">{renderCardProperty(titleValue, titleCol.col)}</div>
      ) : (
        <div className="csv-db-kanban-card-title">Untitled</div>
      )}
      {propertyColumns.map(({ col, dataIdx }) => {
        const value = row[dataIdx];
        const rendered = renderCardProperty(value, col);
        if (!rendered) return null;
        return (
          <div key={col.name} className="csv-db-kanban-card-prop">
            {rendered}
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
