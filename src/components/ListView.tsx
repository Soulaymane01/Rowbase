import { useState, useCallback } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { groupRowsBySelect } from "../query/group";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";

interface ListViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function renderPreview(value: string, col: ColumnDef): React.ReactNode {
  if (!value) return null;
  if (col.type === "select") {
    const opt = col.options?.find((o) => o.value === value);
    return <Tag value={value} color={opt?.color || "gray"} />;
  }
  if (col.type === "multiselect") {
    return (
      <span className="csv-db-list-props">
        {splitMultiSelect(value).map((v) => {
          const opt = col.options?.find((o) => o.value === v);
          return <Tag key={v} value={v} color={opt?.color || "gray"} />;
        })}
      </span>
    );
  }
  if (col.type === "relation") {
    return (
      <span className="csv-db-list-props">
        {splitRelationValue(value, col).map((v) => <RelationPill key={v} value={v} />)}
      </span>
    );
  }
  return <span>{value}</span>;
}

interface RowLineProps {
  row: QueryResultRow;
  displayColumns: DisplayColumn[];
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function RowLine({ row, displayColumns, onDeleteRow, onCardClick }: RowLineProps) {
  const titleCol = displayColumns[0];
  const titleValue = titleCol ? (row.computed?.[titleCol.dataIdx] ?? row.row[titleCol.dataIdx] ?? "") : "";
  const props = displayColumns.slice(1);

  return (
    <div
      className="csv-db-list-row"
      data-row-index={row.originalIndex}
      onClick={() => onCardClick(row.originalIndex)}
    >
      <span className="csv-db-list-title">{titleValue || "Untitled"}</span>
      <span className="csv-db-list-props">
        {props.map(({ col, dataIdx }) => {
          const val = row.computed?.[dataIdx] ?? row.row[dataIdx] ?? "";
          const rendered = renderPreview(val, col);
          return rendered ? <span key={col.name} className="csv-db-list-prop">{rendered}</span> : null;
        })}
      </span>
      <span
        className="csv-db-list-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRow(row.originalIndex);
        }}
      >
        ✕
      </span>
    </div>
  );
}

export function ListView({
  rows,
  columns,
  displayColumns,
  activeView,
  onSetCell,
  onDeleteRow,
  onCardClick,
}: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = useCallback((groupValue: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) next.delete(groupValue);
      else next.add(groupValue);
      return next;
    });
  }, []);

  const groupByColumn = activeView.groupByColumn;
  const groups = groupRowsBySelect(rows, columns, groupByColumn);

  if (groups.length === 0) {
    return (
      <div className="csv-db-list-scroll">
        <div className="csv-db-list">
          {rows.map((r) => (
            <RowLine
              key={r.originalIndex}
              row={r}
              displayColumns={displayColumns}
              onDeleteRow={onDeleteRow}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="csv-db-list-scroll">
      <div className="csv-db-list">
        {groups.map((g) => {
          const label = g.groupValue || "No value";
          const isCollapsed = collapsed.has(g.groupValue);
          return (
            <div key={g.groupValue} className="csv-db-list-group">
              <div
                className="csv-db-list-group-header"
                onClick={() => toggle(g.groupValue)}
              >
                <span className="csv-db-list-chevron">{isCollapsed ? "▸" : "▾"}</span>
                <span className="csv-db-list-group-label">{label}</span>
                <span className="csv-db-list-group-count">{g.rows.length}</span>
              </div>
              {!isCollapsed && (
                <div className="csv-db-list-group-body">
                  {g.rows.map((r) => (
                    <RowLine
                      key={r.originalIndex}
                      row={r}
                      displayColumns={displayColumns}
                      onDeleteRow={onDeleteRow}
                      onCardClick={onCardClick}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
