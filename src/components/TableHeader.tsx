import { useState, useCallback, useEffect, useRef } from "react";
import { DisplayColumn, SortRule } from "../types";
import { getTypeIconElement } from "./TypeIcon";
import { DragState } from "../hooks/useColumnDrag";

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
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  displayIdx: number;
}

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

  return (
    <thead>
      <tr>
        <th className="csv-db-row-drag-header" />
        {displayColumns.map(({ col, dataIdx }, displayIdx) => {
          const isDragged = dragState.isDragging && dragState.dragColIdx === displayIdx;

          const sortRule = sorts.find((s) => s.column === col.name);
          const ariaSort = sortRule ? (sortRule.direction === "asc" ? "ascending" : "descending") : undefined;

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
