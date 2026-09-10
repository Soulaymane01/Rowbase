import { useState, useCallback, useMemo } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { groupRowsBySelect } from "../query/group";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { TAG_COLORS } from "../constants";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";
import { ProgressDisplay } from "./ProgressCell";

interface ListViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
  showRowNumbers: boolean;
  selectedRows: Set<number>;
  onToggleRowSelect: (rowIdx: number) => void;
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
  if (col.type === "progress") {
    return <ProgressDisplay column={col} value={value} />;
  }
  if (col.type === "checkbox") {
    const checked = value === "true";
    return (
      <span className={`csv-db-list-check${checked ? " is-checked" : ""}`} aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
    );
  }
  if (col.type === "note") {
    const basename = value.replace(/\.md$/, "").split("/").pop();
    return (
      <span className="csv-db-list-note" title={value}>
        <span className="csv-db-list-note-icon">📄</span>
        <span>{basename}</span>
      </span>
    );
  }
  return <span>{value}</span>;
}

interface RowLineProps {
  row: QueryResultRow;
  displayColumns: DisplayColumn[];
  showRowNumbers: boolean;
  rowNumber: number;
  selected: boolean;
  onToggleRowSelect: (rowIdx: number) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function RowLine({ row, displayColumns, showRowNumbers, rowNumber, selected, onToggleRowSelect, onDeleteRow, onCardClick }: RowLineProps) {
  const titleCol = displayColumns[0];
  const titleValue = titleCol ? (row.computed?.[titleCol.dataIdx] ?? row.row[titleCol.dataIdx] ?? "") : "";
  const props = displayColumns.slice(1);

  return (
    <div
      className={`csv-db-list-row${selected ? " is-selected" : ""}`}
      data-row-index={row.originalIndex}
      onClick={() => onCardClick(row.originalIndex)}
    >
      {showRowNumbers && <span className="csv-db-list-number">{rowNumber}</span>}
      <input
        type="checkbox"
        className="csv-db-checkbox csv-db-list-checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleRowSelect(row.originalIndex)}
        aria-label="Select row"
      />
      <span className="csv-db-list-title" title={titleValue}>{titleValue || "Untitled"}</span>
      <span className="csv-db-list-props">
        {props.map(({ col, dataIdx }) => {
          const val = row.computed?.[dataIdx] ?? row.row[dataIdx] ?? "";
          const rendered = renderPreview(val, col);
          return rendered ? <span key={col.name} className="csv-db-list-prop">{rendered}</span> : null;
        })}
      </span>
      <button
        className="csv-db-list-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRow(row.originalIndex);
        }}
        title="Delete row"
        aria-label="Delete row"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="3" x2="11" y2="11" />
          <line x1="11" y1="3" x2="3" y2="11" />
        </svg>
      </button>
    </div>
  );
}

export function ListView({
  rows,
  columns,
  displayColumns,
  activeView,
  onDeleteRow,
  onCardClick,
  showRowNumbers,
  selectedRows,
  onToggleRowSelect,
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
  const groupByDef = groupByColumn ? columns.find((c) => c.name === groupByColumn) : undefined;
  const groups = useMemo(
    () => groupRowsBySelect(rows, columns, groupByColumn),
    [rows, columns, groupByColumn]
  );

  // Visible row numbers (1..n in render order, skipping collapsed groups)
  const numbers = useMemo(() => {
    const map = new Map<number, number>();
    let n = 0;
    if (groups.length === 0) {
      rows.forEach((r) => map.set(r.originalIndex, ++n));
    } else {
      for (const g of groups) {
        if (collapsed.has(g.groupValue)) continue;
        g.rows.forEach((r) => map.set(r.originalIndex, ++n));
      }
    }
    return map;
  }, [rows, groups, collapsed]);

  const groupColor = useCallback((value: string) => {
    if (!groupByDef || groupByDef.type !== "select") return "var(--text-muted)";
    const color = groupByDef.options?.find((o) => o.value === value)?.color;
    return color ? TAG_COLORS[color]?.bg : "var(--text-faint)";
  }, [groupByDef]);

  if (rows.length === 0) {
    return (
      <div className="csv-db-list-scroll">
        <div className="csv-db-empty">
          <div className="csv-db-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3.5" cy="6" r="1" />
              <circle cx="3.5" cy="12" r="1" />
              <circle cx="3.5" cy="18" r="1" />
            </svg>
          </div>
          <div className="csv-db-empty-title">No rows yet</div>
          <div className="csv-db-empty-desc">Add a row to see it listed here.</div>
        </div>
      </div>
    );
  }

  const renderRow = (r: QueryResultRow) => (
    <RowLine
      key={r.originalIndex}
      row={r}
      displayColumns={displayColumns}
      showRowNumbers={showRowNumbers}
      rowNumber={numbers.get(r.originalIndex) ?? 0}
      selected={selectedRows.has(r.originalIndex)}
      onToggleRowSelect={onToggleRowSelect}
      onDeleteRow={onDeleteRow}
      onCardClick={onCardClick}
    />
  );

  if (groups.length === 0) {
    return (
      <div className="csv-db-list-scroll">
        <div className="csv-db-list">{rows.map(renderRow)}</div>
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
                <span className="csv-db-list-group-dot" style={{ background: groupColor(g.groupValue) }} />
                <span className="csv-db-list-group-label">{label}</span>
                <span className="csv-db-list-group-count">{g.rows.length}</span>
              </div>
              {!isCollapsed && (
                <div className="csv-db-list-group-body">
                  {g.rows.map(renderRow)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
