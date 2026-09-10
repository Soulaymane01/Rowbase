import { useCallback } from "react";

const DRAG_THRESHOLD = 5;

interface UseBoardColumnDragOptions {
  onReorder: (fromGroupValue: string, toGroupValue: string, position: "before" | "after") => void;
}

/**
 * Drag-and-drop reordering for kanban board columns.
 * A ghost clone of the column follows the cursor; the drop position is
 * highlighted on the target column. The "No value" column is neither
 * draggable nor a valid drop target (it always stays last).
 */
export function useBoardColumnDrag({ onReorder }: UseBoardColumnDragOptions) {
  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;

      const headerEl = (e.currentTarget as HTMLElement).closest(".csv-db-kanban-column-header");
      const columnEl = headerEl?.closest(".csv-db-kanban-column");
      if (!(columnEl instanceof HTMLElement)) return;
      const groupValue = columnEl.getAttribute("data-group-value") ?? "";
      if (!groupValue) return;

      const boardEl = columnEl.closest(".csv-db-kanban-board");
      const doc = activeDocument;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let ghost: HTMLElement | null = null;
      let ghostOffsetX = 0;
      let ghostOffsetY = 0;
      let dropTarget: HTMLElement | null = null;
      let dropPosition: "before" | "after" = "before";

      const clearDrop = () => {
        if (!dropTarget) return;
        dropTarget.classList.remove("csv-db-kanban-col-drop-before", "csv-db-kanban-col-drop-after");
        dropTarget = null;
      };

      const setDropSide = (target: HTMLElement, position: "before" | "after") => {
        target.classList.remove("csv-db-kanban-col-drop-before", "csv-db-kanban-col-drop-after");
        dropPosition = position;
        target.classList.add(position === "after" ? "csv-db-kanban-col-drop-after" : "csv-db-kanban-col-drop-before");
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragging) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
          dragging = true;
          doc.body.classList.add("csv-db-kanban-col-dragging");

          const rect = columnEl.getBoundingClientRect();
          ghost = columnEl.cloneNode(true) as HTMLElement;
          ghost.removeAttribute("data-group-value");
          ghost.className = "csv-db-kanban-col-ghost";
          ghost.setCssProps({
            width: `${rect.width}px`,
            left: `${rect.left}px`,
            top: `${rect.top}px`,
          });
          doc.body.appendChild(ghost);
          ghostOffsetX = rect.left - startX;
          ghostOffsetY = rect.top - startY;
          columnEl.classList.add("csv-db-kanban-col-dragging-source");
        }

        if (ghost) {
          ghost.setCssProps({
            left: `${ev.clientX + ghostOffsetX}px`,
            top: `${ev.clientY + ghostOffsetY}px`,
          });
        }

        const target = getColumnAtPoint(ev.clientX, ev.clientY, boardEl, columnEl);
        if (!target) {
          clearDrop();
          return;
        }
        if (target !== dropTarget) {
          clearDrop();
          dropTarget = target;
          const rect = target.getBoundingClientRect();
          setDropSide(target, ev.clientX > rect.left + rect.width / 2 ? "after" : "before");
        } else {
          const rect = target.getBoundingClientRect();
          const side: "before" | "after" = ev.clientX > rect.left + rect.width / 2 ? "after" : "before";
          if (side !== dropPosition) setDropSide(target, side);
        }
      };

      const onUp = () => {
        doc.removeEventListener("mousemove", onMove);
        doc.removeEventListener("mouseup", onUp);
        doc.body.classList.remove("csv-db-kanban-col-dragging");

        const target = dropTarget;
        const position = dropPosition;
        ghost?.remove();
        ghost = null;
        columnEl.classList.remove("csv-db-kanban-col-dragging-source");
        clearDrop();

        if (dragging && target) {
          const targetGroupValue = target.getAttribute("data-group-value") ?? "";
          if (targetGroupValue && targetGroupValue !== groupValue) {
            onReorder(groupValue, targetGroupValue, position);
          }
        }
      };

      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseup", onUp);
    },
    [onReorder]
  );

  return { onHeaderMouseDown };
}

function getColumnAtPoint(x: number, y: number, board: Element | null, exclude: HTMLElement | null): HTMLElement | null {
  const container = board || activeDocument;
  const columns = container.querySelectorAll<HTMLElement>(".csv-db-kanban-column");
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col === exclude) continue;
    const rect = col.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const value = col.getAttribute("data-group-value") ?? "";
      if (!value) continue;
      return col;
    }
  }
  return null;
}
