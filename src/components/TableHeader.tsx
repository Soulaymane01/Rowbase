import { useState, useCallback, useEffect, useRef } from "react";
import { DisplayColumn, SortRule } from "../types";
import { getTypeIconElement } from "./TypeIcon";
import { DragState } from "../hooks/useColumnDrag";

const SEARCHABLE_TYPES = new Set([
  "text", "title", "note", "relation", "select", "multiselect",
  "number", "date", "url", "link", "formula", "rollup",
]);

interface TableHeaderProps {
  displayColumns: DisplayColumn[];
  sorts: SortRule[];
  onResizeStart: (colIdx: number, e: React.MouseEvent) => void;
  consumeJustResized: () => boolean;
  onAddColumn: () => void;
  onColumnClick: (dataIdx: number) => void;
  onDragStart: (displayIdx: number, e: React.MouseEvent) => void;
  consumeJustDragged: () => boolean;
  dragState: DragState;
  onFitToContent: (displayIdx: number) => void;
  onResetWidth: (displayIdx: number) => void;
  selectedCount: number;
  visibleRowCount: number;
  onToggleSelectAll: () => void;
  onQuickSort: (columnName: string) => void;
  openSearchColumns: Set<string>;
  searchValues: Record<string, string>;
  searchFocusColumn: string | null;
  onToggleSearch: (columnName: string) => void;
  onSearchChange: (columnName: string, value: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  displayIdx: number;
}

const searchIconSvg = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="5" cy="5" r="3.4" />
    <line x1="7.6" y1="7.6" x2="10.6" y2="10.6" />
  </svg>
);

export function TableHeader({
  displayColumns,
  sorts,
  onResizeStart,
  consumeJustResized,
  onAddColumn,
  onColumnClick,
  onDragStart,
  consumeJustDragged,
  dragState,
  onFitToContent,
  onResetWidth,
  selectedCount,
  visibleRowCount,
  onToggleSelectAll,
  onQuickSort,
  openSearchColumns,
  searchValues,
  searchFocusColumn,
  onToggleSearch,
  onSearchChange,
}: TableHeaderProps) {
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu?.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeCtxMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu?.visible, closeCtxMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, displayIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, displayIdx });
    },
    []
  );

  const allSelected = visibleRowCount > 0 && selectedCount === visibleRowCount;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <thead>
      <tr>
        <th className="csv-db-row-select-header">
          <input
            type="checkbox"
            className="csv-db-checkbox csv-db-row-select-checkbox csv-db-row-select-all"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleSelectAll}
            aria-label="Select all rows"
            title="Select all rows"
          />
        </th>
        {displayColumns.map(({ col, dataIdx }, displayIdx) => {
          const isDragged = dragState.isDragging && dragState.dragColIdx === displayIdx;

          const sortIdx = sorts.findIndex((s) => s.column === col.name);
          const sortRule = sortIdx !== -1 ? sorts[sortIdx] : undefined;
          const ariaSort = sortRule ? (sortRule.direction === "asc" ? "ascending" : "descending") : undefined;
          const isSearchable = SEARCHABLE_TYPES.has(col.type);
          const searchOpen = isSearchable && openSearchColumns.has(col.name);
          const hasSearchValue = searchOpen && (searchValues[col.name] ?? "").trim() !== "";

          return (
            <th
              key={dataIdx}
              className={`csv-db-header-cell${isDragged ? " csv-db-header-dragging" : ""}`}
              aria-sort={ariaSort}
              onMouseDown={(e) => {
                onDragStart(displayIdx, e);
              }}
              onClick={() => {
                if (consumeJustResized()) return;
                if (consumeJustDragged()) return;
                onColumnClick(dataIdx);
              }}
              onContextMenu={(e) => handleContextMenu(e, displayIdx)}
            >
              <div className="csv-db-header-content">
                <span className="csv-db-header-icon">{getTypeIconElement(col.type)}</span>
                <span className="csv-db-header-name">{col.name}</span>
                <span
                  className={`csv-db-header-sort${sortRule ? " csv-db-header-sort-active" : ""}`}
                  role="button"
                  aria-label={`Sort by ${col.name}`}
                  title={sortRule ? `Sorted ${sortRule.direction === "asc" ? "ascending" : "descending"} — click to toggle` : "Sort"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickSort(col.name);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {sortRule ? (sortRule.direction === "asc" ? "↑" : "↓") : "⇅"}
                  {sortRule && sorts.length > 1 && (
                    <span className="csv-db-header-sort-order">{sortIdx + 1}</span>
                  )}
                </span>
                {isSearchable && (
                  <span
                    className={`csv-db-header-search-toggle${searchOpen ? " csv-db-header-search-active" : ""}`}
                    role="button"
                    aria-label={`Search ${col.name}`}
                    title={searchOpen ? "Close search" : "Search column"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSearch(col.name);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {searchIconSvg}
                  </span>
                )}
                {hasSearchValue && <span className="csv-db-header-search-dot" />}
              </div>
              <div
                className="csv-db-resize-handle"
                onMouseDown={(e) => onResizeStart(displayIdx, e)}
                onDoubleClick={() => {
                  onFitToContent(displayIdx);
                }}
              />
            </th>
          );
        })}
        <th
          className="csv-db-add-column-cell"
          onClick={(e) => {
            e.stopPropagation();
            onAddColumn();
          }}
        >
          <div className="csv-db-add-column-btn">+</div>
        </th>
      </tr>
      {openSearchColumns.size > 0 && (
        <tr className="csv-db-search-row">
          <th className="csv-db-row-select-header" />
          {displayColumns.map(({ col }) => {
            if (!SEARCHABLE_TYPES.has(col.type) || !openSearchColumns.has(col.name)) {
              return <th key={col.name} className="csv-db-search-cell" />;
            }
            const value = searchValues[col.name] ?? "";
            return (
              <th key={col.name} className="csv-db-search-cell" data-column-name={col.name}>
                <input
                  className="csv-db-search-input"
                  type="text"
                  placeholder="Search"
                  value={value}
                  autoFocus={col.name === searchFocusColumn}
                  onFocus={(e) => e.target.select()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      onSearchChange(col.name, "");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onChange={(e) => onSearchChange(col.name, e.target.value)}
                />
              </th>
            );
          })}
          <th className="csv-db-add-column-cell" />
        </tr>
      )}
      {ctxMenu?.visible && (
        <div
          ref={menuRef}
          className="csv-db-col-context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            className="csv-db-col-context-menu-item"
            onClick={() => {
              onFitToContent(ctxMenu.displayIdx);
              closeCtxMenu();
            }}
          >
            Fit to content
          </button>
          <button
            className="csv-db-col-context-menu-item"
            onClick={() => {
              onResetWidth(ctxMenu.displayIdx);
              closeCtxMenu();
            }}
          >
            Reset to default (180px)
          </button>
        </div>
      )}
    </thead>
  );
}
