import { useCallback, useRef } from "react";

const DRAG_THRESHOLD = 5;

interface UseMatrixDragOptions {
  onCardMove: (rowOriginalIndex: number, targetQuadrant: string) => void;
}

/** Drag matrix cards between quadrants (mirrors the kanban board's card drag). */
export function useMatrixDrag({ onCardMove }: UseMatrixDragOptions) {
  const dragRef = useRef<{
    rowOriginalIndex: number;
    sourceQuadrant: string;
    ghost: HTMLElement | null;
    sourceCard: Element | null;
    grid: Element | null;
  } | null>(null);
  const justDraggedRef = useRef(false);

  const onCardMouseDown = useCallback(
    (e: React.MouseEvent, rowOriginalIndex: number) => {
      if (e.button !== 0) return;

      const doc = activeDocument;
      const startX = e.clientX;
      const startY = e.clientY;
      const cardEl = (e.currentTarget as HTMLElement).closest(".csv-db-matrix-card");
      if (!(cardEl instanceof HTMLElement)) return;

      const quadrantEl = cardEl.closest(".csv-db-matrix-quadrant");
      const sourceQuadrant = quadrantEl?.getAttribute("data-quadrant") ?? "";
      const gridEl = cardEl.closest(".csv-db-matrix-grid");

      let dragging = false;
      let ghostOffsetX = 0;
      let ghostOffsetY = 0;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!dragging) {
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
            return;
          }
          dragging = true;
          doc.body.classList.add("csv-db-matrix-dragging");

          const ghost = cardEl.cloneNode(true) as HTMLElement;
          const rect = cardEl.getBoundingClientRect();
          ghost.className = "csv-db-matrix-card-ghost";
          ghost.setCssProps({
            width: `${rect.width}px`,
            left: `${rect.left}px`,
            top: `${rect.top}px`,
          });
          doc.body.appendChild(ghost);

          ghostOffsetX = rect.left - startX;
          ghostOffsetY = rect.top - startY;

          cardEl.classList.add("csv-db-matrix-card-dragging-source");

          dragRef.current = {
            rowOriginalIndex,
            sourceQuadrant,
            ghost,
            sourceCard: cardEl,
            grid: gridEl,
          };
        }

        if (dragRef.current?.ghost) {
          dragRef.current.ghost.setCssProps({
            left: `${ev.clientX + ghostOffsetX}px`,
            top: `${ev.clientY + ghostOffsetY}px`,
          });
        }

        if (gridEl) {
          gridEl.querySelectorAll(".csv-db-matrix-quadrant").forEach((q) => {
            q.classList.remove("csv-db-matrix-quadrant-drop-target");
          });
        }
        const target = getQuadrantAtPoint(ev.clientX, ev.clientY, gridEl);
        if (target && target.getAttribute("data-quadrant") !== sourceQuadrant) {
          target.classList.add("csv-db-matrix-quadrant-drop-target");
        }
      };

      const onUp = (ev: MouseEvent) => {
        doc.removeEventListener("mousemove", onMove);
        doc.removeEventListener("mouseup", onUp);

        if (!dragging) return;

        doc.body.classList.remove("csv-db-matrix-dragging");
        justDraggedRef.current = true;
        window.requestAnimationFrame(() => {
          justDraggedRef.current = false;
        });

        if (dragRef.current?.ghost) {
          dragRef.current.ghost.remove();
        }
        if (dragRef.current?.sourceCard) {
          dragRef.current.sourceCard.classList.remove("csv-db-matrix-card-dragging-source");
        }
        if (gridEl) {
          gridEl.querySelectorAll(".csv-db-matrix-quadrant").forEach((q) => {
            q.classList.remove("csv-db-matrix-quadrant-drop-target");
          });
        }

        const target = getQuadrantAtPoint(ev.clientX, ev.clientY, gridEl);
        if (target && dragRef.current) {
          const targetQuadrant = target.getAttribute("data-quadrant") ?? "";
          if (targetQuadrant && targetQuadrant !== dragRef.current.sourceQuadrant) {
            onCardMove(dragRef.current.rowOriginalIndex, targetQuadrant);
          }
        }

        dragRef.current = null;
      };

      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseup", onUp);
    },
    [onCardMove]
  );

  const consumeJustDragged = useCallback((): boolean => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { onCardMouseDown, consumeJustDragged };
}

function getQuadrantAtPoint(x: number, y: number, grid: Element | null): Element | null {
  const container = grid || document;
  const quadrants = container.querySelectorAll(".csv-db-matrix-quadrant");
  for (let i = 0; i < quadrants.length; i++) {
    const q = quadrants[i];
    const rect = q.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return q;
    }
  }
  return null;
}
